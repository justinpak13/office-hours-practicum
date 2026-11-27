import { Role } from '@koh/common';
import { ConsoleLogger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { CourseModel } from '../course/course.entity';
import { LoginCourseService } from '../login/login-course.service';
import { ProfSectionGroupsModel } from '../login/prof-section-groups.entity';
import { UserCourseModel } from '../profile/user-course.entity';
import { UserModel } from '../profile/user.entity';
import { KhouryAdminClient } from './khoury-admin.client';
import { KhouryAdminError } from './khoury-admin.types';

export function normalizeEmail(email: string): string {
  return email.toLowerCase().replace(/@husky\.neu\.edu$/, '@northeastern.edu');
}

export function khouryRoleToRole(r: 'Professor' | 'TA' | 'Student'): Role {
  return { Professor: Role.PROFESSOR, TA: Role.TA, Student: Role.STUDENT }[r];
}

const RANK = { [Role.STUDENT]: 0, [Role.TA]: 1, [Role.PROFESSOR]: 2 };
export function higherRole(a: Role, b: Role): Role {
  return RANK[b] > RANK[a] ? b : a;
}

@Injectable()
export class KhouryAdminSyncService {
  private readonly logger = new ConsoleLogger(KhouryAdminSyncService.name);

  constructor(
    private client: KhouryAdminClient,
    private config: ConfigService,
    private loginCourse: LoginCourseService,
    private dataSource: DataSource,
  ) {}

  // NOTE: the advisory lock serializes sync; the legacy-only unique email index on user_model is the DB backstop (the old login path is not covered by the lock)
  private locked<T>(
    key: string,
    fn: (m: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
      return fn(m);
    });
  }

  async onSignIn(
    email: string,
    name: { first: string; last: string },
  ): Promise<UserModel> {
    const norm = normalizeEmail(email);
    const user = await this.locked('koh:user:' + norm, async (m) => {
      const find = () =>
        m
          .createQueryBuilder(UserModel, 'u')
          .where('LOWER(u.email) = :email', { email: norm })
          // NOTE: legacy rows only, a Keycloak user may share this email; T22 replaces this method
          .andWhere('u."keycloakSub" IS NULL')
          .getOne();
      // NOTE: legacy mixed-case rows only match via LOWER(), so look first; orIgnore (ON CONFLICT DO NOTHING) keeps the transaction alive if an exact-email row appears anyway
      const found = await find();
      if (found) return found;
      await m
        .createQueryBuilder()
        .insert()
        .into(UserModel)
        .values({ email: norm, firstName: name.first, lastName: name.last })
        .orIgnore()
        .execute();
      return (await find())!;
    });
    // NOTE: single semester from env; must be bumped each term and profs can't see next term early; compute from date when going live
    const semester = this.config.get('KHOURY_SEMESTER');

    // NOTE: allSettled so both requests run together without an unhandled rejection
    const [a, b] = await Promise.allSettled([
      this.client.getSectionGroups(norm, semester),
      this.client.getCourses(norm, semester),
    ]);
    try {
      if (a.status === 'rejected') throw a.reason;
      await this.saveSectionGroups(user, a.value.section_groups, semester);
    } catch (e) {
      this.logFailure('A', e);
    }
    try {
      if (b.status === 'rejected') throw b.reason;
      // NOTE: duplicate entries for one group collapse to the highest role
      const best = new Map<string, Role>();
      for (const c of b.value.courses) {
        const r = khouryRoleToRole(c.role);
        const prev = best.get(c.section_group_id);
        best.set(c.section_group_id, prev ? higherRole(prev, r) : r);
      }
      for (const [groupId, role] of best) {
        const course = await CourseModel.findOne({
          where: { khourySectionGroupId: groupId },
        });
        if (course?.enabled) {
          await this.upsertMembership(user.id, course.id, role);
        }
      }
    } catch (e) {
      this.logFailure('B', e);
    }
    return user;
  }

  private async saveSectionGroups(
    user: UserModel,
    groups: { id: string; name: string; crns: number[] }[],
    semester: string,
  ) {
    if (
      groups.length === 0 &&
      !(await ProfSectionGroupsModel.findOneBy({ profId: user.id }))
    )
      return;
    const sectionGroups = groups.map((g) => ({ ...g, semester }));
    // NOTE: profId is unique (one-to-one), so concurrent first sign-ins converge on one row
    await ProfSectionGroupsModel.upsert({ profId: user.id, sectionGroups }, [
      'profId',
    ]);

    const cOld = new Map<string, 'gone' | 'kept' | 'error'>(); // C result per old id: one call and one warn per sign-in
    for (const g of groups) {
      const courses: CourseModel[] = [];
      for (const crn of g.crns) {
        const c = await this.loginCourse.courseCRNToCourse(crn, semester);
        if (c) courses.push(c);
      }
      if (courses.some((c) => c.khourySectionGroupId === g.id)) continue;
      // NOTE: conditional update; the unique index turns "another course holds this id" (or a race) into a 23505 we skip.
      // Alex's move rule: a course group's (sg_2) sections can move into a set-up group (sg_1), and the old id 404s once empty.
      // So sg_2 -> sg_1 re-links only once the old id is gone: first absent from this A response (cheap filter), then
      // confirmed by C returning 404 (empty everywhere). A alone isn't enough: a co-taught course's other sections may
      // still sit in the sg_2 group for another professor. A partial move waits until the last section moves.
      // Nothing else moves a linked course.
      // Re-link clears the stamp (it came from another group); the first link (null id) keeps it.
      // Only one course can hold an id, so if one sg_1 group's CRNs map to two sg_2-linked courses, only the first is re-linked.
      // A held course (C returned a roster, or failed) blocks the whole group, whatever the CRN order, so its sg_1 id stays
      // free for it and no sibling takes it. It blocks every sg_1 group with one of its CRNs until its old group empties;
      // that resolves on the next sign-in after the move completes.
      // A still listing the old id is a partial move: held without calling C. getRoster errors are always
      // KhouryAdminError (the client wraps everything), so any other throw is a bug and
      // stops the rest of A's save (the sections row and links already written stay).
      let held = false;
      for (const c of courses) {
        const old = c.khourySectionGroupId;
        if (!old?.startsWith('sg_2') || !g.id.startsWith('sg_1')) continue;
        held =
          groups.some((x) => x.id === old) ||
          (await this.oldGroupState(old, cOld)) !== 'gone';
        if (held) break;
      }
      if (held) continue;
      for (const course of courses) {
        try {
          const res = await CourseModel.createQueryBuilder()
            .update()
            .set({
              khourySectionGroupId: g.id,
              khouryRosterGeneratedAt: () =>
                'CASE WHEN "khourySectionGroupId" IS NULL THEN "khouryRosterGeneratedAt" ELSE NULL END',
            })
            .where(
              'id = :id AND ("khourySectionGroupId" IS NULL OR ("khourySectionGroupId" LIKE \'sg\\_2%\' AND :newId LIKE \'sg\\_1%\' AND "khourySectionGroupId" NOT IN (:...currentIds)))',
              {
                id: course.id,
                newId: g.id,
                currentIds: groups.map((x) => x.id),
              },
            )
            .execute();
          if (res.affected === 1) break;
          // 0 rows: this course belongs to another group, try the next CRN
        } catch (e) {
          if (e?.driverError?.code !== '23505') throw e;
          this.logger.warn(
            `Course ${course.id}: ${g.id} already held by another course, link skipped`,
          );
          break;
        }
      }
    }
  }

  private async oldGroupState(
    id: string,
    cache: Map<string, 'gone' | 'kept' | 'error'>,
  ) {
    if (!cache.has(id)) {
      try {
        cache.set(id, (await this.client.getRoster(id)) ? 'kept' : 'gone');
      } catch (e) {
        if (!(e instanceof KhouryAdminError)) throw e;
        this.logger.warn(
          `Khoury Admin C ${id} failed, not re-linking: ${e.message}`,
        );
        cache.set(id, 'error');
      }
    }
    return cache.get(id);
  }

  private upsertMembership(userId: number, courseId: number, role: Role) {
    return this.locked(`koh:uc:${userId}:${courseId}`, async (m) => {
      const uc = await m.findOneBy(UserCourseModel, { userId, courseId });
      if (!uc) {
        await m.save(m.create(UserCourseModel, { userId, courseId, role }));
        return;
      }
      // NOTE: self-enroll placeholder (override+expires) upgrades and becomes permanent; manual pin (override only) keeps its role, same role clears the flag; normal row upgrades and loses expires
      let changed = false;
      if (uc.override && !uc.expires) {
        if (uc.role === role) {
          uc.override = false;
          changed = true;
        }
      } else {
        const up = higherRole(uc.role, role);
        if (up !== uc.role) {
          uc.role = up;
          changed = true;
        }
        if (uc.override || uc.expires) {
          uc.override = false;
          uc.expires = false;
          changed = true;
        }
      }
      if (changed) await m.save(uc);
    });
  }

  // A failed call keeps what OH already has; anything else is a real bug
  private logFailure(which: string, e: unknown) {
    if (!(e instanceof KhouryAdminError)) throw e;
    this.logger.warn(`Khoury Admin ${which} failed: ${e.message}`);
  }
}
