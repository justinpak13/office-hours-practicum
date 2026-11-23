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

// Minimum gap between syncs for one user (a constant on purpose, not config)
const SYNC_HOURS = 24;

@Injectable()
export class KhouryAdminSyncService {
  private readonly logger = new ConsoleLogger(KhouryAdminSyncService.name);

  constructor(
    private client: KhouryAdminClient,
    private config: ConfigService,
    private loginCourse: LoginCourseService,
    private dataSource: DataSource,
  ) {}

  // NOTE: the advisory lock only serializes membership upserts per user and course; the sync itself is claimed by the conditional UPDATE in syncIfDue
  private locked<T>(
    key: string,
    fn: (m: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
      return fn(m);
    });
  }

  // Runs the sync for a user at most once per 24h. The conditional UPDATE both checks the gate and claims the run, so concurrent requests can't both sync.
  // NOTE: retry after 24h on failure; shorten if outages matter
  // NOTE: a user whose first sync ran without a NUID gets B on the next due sync (up to 24h later), and a stale save() of a user loaded before the claim can null the stamp and cause one extra (idempotent) sync; both accepted
  async syncIfDue(user: UserModel): Promise<void> {
    // Cheap in-memory check; the UPDATE below stays the race-safe claim
    if (
      user.lastKhourySyncAt &&
      Date.now() - user.lastKhourySyncAt.getTime() < SYNC_HOURS * 3600_000
    )
      return;
    const claimed = await UserModel.createQueryBuilder()
      .update()
      .set({ lastKhourySyncAt: () => 'now()' })
      .where(
        `id = :id AND ("lastKhourySyncAt" IS NULL OR "lastKhourySyncAt" < now() - interval '${SYNC_HOURS} hours')`,
        { id: user.id },
      )
      .execute();
    if (claimed.affected !== 1) return;
    await this.onSignIn(user);
  }

  async onSignIn(user: UserModel): Promise<void> {
    const norm = normalizeEmail(user.email);
    // NOTE: single semester from env; must be bumped each term and profs can't see next term early; compute from date when going live
    const semester = this.config.get('KHOURY_SEMESTER');
    const nuid = user.nuid?.trim();

    // NOTE: allSettled so both requests run together without an unhandled rejection
    const [a, b] = await Promise.allSettled([
      this.client.getSectionGroups(norm, semester),
      // NOTE: B needs the NUID; without one only A runs
      nuid
        ? this.client.getCourses(norm, semester, nuid)
        : Promise.resolve(null),
    ]);
    // NOTE: A and B are independent; an unexpected error (not KhouryAdminError) in one is logged, B still runs, and it is rethrown at the end
    let bug: unknown;
    try {
      if (a.status === 'rejected') throw a.reason;
      await this.saveSectionGroups(user, a.value.section_groups, semester);
    } catch (e) {
      bug ??= this.logFailure('A', e);
    }
    try {
      if (b.status === 'rejected') throw b.reason;
      if (b.value === null) {
        this.logger.warn(
          `Skipping Khoury Admin B: user ${user.id} has no NUID`,
        );
      } else {
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
      }
    } catch (e) {
      bug ??= this.logFailure('B', e);
    }
    if (bug) throw bug;
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
      // Nothing else moves a linked course. Eligibility is decided in JS from the id read; the update only
      // applies if the id is still that value, so a concurrent link can't slip a course past the C check.
      // Re-link clears the stamp (it came from another group); the first link (null id) keeps it.
      // Only one course can hold an id, so if one sg_1 group's CRNs map to two sg_2-linked courses, only the first is re-linked.
      // A held course (C returned a roster, or failed) blocks the whole group, whatever the CRN order, so its sg_1 id stays
      // free for it and no sibling takes it. It blocks every sg_1 group with one of its CRNs until its old group empties;
      // that resolves on the next sign-in after the move completes.
      // A still listing the old id is a partial move: held without calling C. getRoster errors are always
      // KhouryAdminError (the client wraps everything), so any other throw is a bug and
      // stops the rest of A's save (the sections row and links already written stay).
      const currentIds = groups.map((x) => x.id);
      const movable = (old: string | null) =>
        !!old?.startsWith('sg_2') && g.id.startsWith('sg_1');
      let held = false;
      for (const c of courses) {
        const old = c.khourySectionGroupId;
        if (!movable(old)) continue;
        held =
          currentIds.includes(old) ||
          (await this.oldGroupState(old, cOld)) !== 'gone';
        if (held) break;
      }
      if (held) continue;
      for (const course of courses) {
        const old = course.khourySectionGroupId;
        const eligible =
          old === null || (movable(old) && !currentIds.includes(old));
        if (!eligible) continue; // belongs to another group, try the next CRN
        try {
          const res = await CourseModel.createQueryBuilder()
            .update()
            .set({
              khourySectionGroupId: g.id,
              khouryRosterGeneratedAt: () =>
                'CASE WHEN "khourySectionGroupId" IS NULL THEN "khouryRosterGeneratedAt" ELSE NULL END',
            })
            .where(
              'id = :id AND "khourySectionGroupId" IS NOT DISTINCT FROM CAST(:old AS text)',
              { id: course.id, old },
            )
            .execute();
          // Success or a lost race both stop the group, so no sibling takes the id; a lost race resolves on the next sign-in.
          if (res.affected !== 1)
            this.logger.warn(
              `Course ${course.id}: group id changed during sign-in, ${g.id} not linked`,
            );
          break;
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

  // A failed call keeps what OH already has. Returns the error when it is a real bug (already logged with its stack) so the caller can rethrow it later
  private logFailure(which: string, e: any): unknown {
    if (e instanceof KhouryAdminError) {
      this.logger.warn(`Khoury Admin ${which} failed: ${e.message}`);
      return undefined;
    }
    this.logger.error(
      `Khoury Admin ${which} failed unexpectedly: ${e?.message}`,
      e?.stack,
    );
    return e;
  }
}
