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
  return email
    .trim()
    .toLowerCase()
    .replace(/@husky\.neu\.edu$/, '@northeastern.edu');
}

export function khouryRoleToRole(r: 'Professor' | 'TA' | 'Student'): Role {
  return { Professor: Role.PROFESSOR, TA: Role.TA, Student: Role.STUDENT }[r];
}

const RANK = { [Role.STUDENT]: 0, [Role.TA]: 1, [Role.PROFESSOR]: 2 };
export function higherRole(a: Role, b: Role): Role {
  return RANK[b] > RANK[a] ? b : a;
}

// NOTE: not util.inspect: a QueryFailedError carries the query, parameters and driver detail (user emails). Prints only messages and stacks, following `cause` and `errors`.
export function describeError(e: unknown, depth = 0): string {
  let text: string;
  try {
    text =
      e instanceof Error && e.stack
        ? e.stack
        : String((e as any)?.message ?? String(e));
  } catch {
    text = 'unknown error';
  }
  if (depth >= 4 || e === null || typeof e !== 'object') return text;
  const kids = [
    ...('cause' in e ? [(e as any).cause] : []),
    ...(Array.isArray((e as any).errors) ? (e as any).errors : []),
  ];
  return [text, ...kids.map((k) => describeError(k, depth + 1))].join('\n  ');
}

// Minimum gap between syncs for one user (a constant on purpose, not config)
const SYNC_HOURS = 24;
// NOTE: after a failed sync the user is due again this many minutes later instead of after SYNC_HOURS
const RETRY_MINUTES = 15;

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
  // NOTE: a failed sync (onSignIn returned false or threw) moves the stamp back so the user is due again RETRY_MINUTES later
  // NOTE: a user whose first sync ran without a NUID gets B on the next due sync (up to 24h later), and a stale save() of a user loaded before the claim can null the stamp and cause one extra (idempotent) sync; both accepted
  // NOTE: the in-memory check uses the app clock and the claim uses the DB clock; small drift only delays a sync or adds a no-op query, accepted
  async syncIfDue(user: UserModel): Promise<void> {
    // Cheap in-memory check; the UPDATE below stays the race-safe claim
    if (
      user.lastKhourySyncAt &&
      Date.now() - user.lastKhourySyncAt.getTime() < SYNC_HOURS * 3600_000
    )
      return;
    const claimed = await UserModel.createQueryBuilder()
      .update()
      // NOTE: truncated to ms so the returned JS Date matches the stored value exactly in releaseClaim
      .set({ lastKhourySyncAt: () => "date_trunc('milliseconds', now())" })
      .where(
        `id = :id AND ("lastKhourySyncAt" IS NULL OR "lastKhourySyncAt" < now() - interval '${SYNC_HOURS} hours')`,
        { id: user.id },
      )
      .returning('"lastKhourySyncAt"')
      .execute();
    if (claimed.affected !== 1) return;
    const stamp: Date = claimed.raw[0].lastKhourySyncAt;
    user.lastKhourySyncAt = stamp;
    let ok = false;
    try {
      ok = await this.onSignIn(user);
    } finally {
      if (!ok) await this.releaseClaim(user, stamp);
    }
  }

  // NOTE: moves our claim back so the user is due again in RETRY_MINUTES. Only if the stamp is still ours, so a newer sync is never overwritten. A DB error here is caught and logged, so the sync's own error (if any) is still what reaches the hook.
  private async releaseClaim(user: UserModel, stamp: Date): Promise<void> {
    const retryAt = new Date(
      stamp.getTime() - SYNC_HOURS * 3600_000 + RETRY_MINUTES * 60_000,
    );
    try {
      const res = await UserModel.createQueryBuilder()
        .update()
        .set({ lastKhourySyncAt: retryAt })
        .where('id = :id AND "lastKhourySyncAt" = :stamp', {
          id: user.id,
          stamp,
        })
        .execute();
      if (res.affected === 1) user.lastKhourySyncAt = retryAt;
    } catch (e) {
      this.logger.error(
        `Khoury Admin sync claim release failed: ${describeError(e)}`,
      );
    }
  }

  // NOTE: returns true when every fetch that ran and every save succeeded (a skipped A or B is not a failure); false when a KhouryAdminError was swallowed; throws on any other error
  async onSignIn(user: UserModel): Promise<boolean> {
    // NOTE: a null or blank email skips both A and B (both URLs contain the email) instead of throwing
    const norm = user.email?.trim() ? normalizeEmail(user.email) : null;
    // NOTE: single semester from env; must be bumped each term and profs can't see next term early; compute from date when going live
    const semester = this.config.get('KHOURY_SEMESTER');
    const nuid = user.nuid?.trim();

    // NOTE: allSettled so both requests run together without an unhandled rejection
    const [a, b] = await Promise.allSettled([
      norm
        ? this.client.getSectionGroups(norm, semester)
        : Promise.resolve(null),
      // NOTE: B needs the NUID; without one only A runs (and without an email, neither runs)
      nuid && norm
        ? this.client.getCourses(norm, semester, nuid)
        : Promise.resolve(null),
    ]);
    // NOTE: A and B are independent; an unexpected error (not KhouryAdminError) in one is kept, B still runs, and at the end one error is rethrown (an Error carrying both in `errors` if both failed). Each is tagged with its source (A or B) and keeps the original as `cause`. The JwtStrategy hook logs the failed sync once, (messages and stacks only); a KhouryAdminError is an expected outage and only warns here
    const bugs: unknown[] = [];
    let failed = false;
    try {
      if (a.status === 'rejected') throw a.reason;
      if (a.value === null) {
        this.logger.warn(
          `Skipping Khoury Admin A: user ${user.id} has no email`,
        );
      } else {
        await this.saveSectionGroups(user, a.value.section_groups, semester);
      }
    } catch (e) {
      failed = true;
      if (this.logFailure('A', e))
        bugs.push(
          Object.assign(new Error('Khoury Admin A failed'), { cause: e }),
        );
    }
    try {
      if (b.status === 'rejected') throw b.reason;
      if (b.value === null) {
        this.logger.warn(
          `Skipping Khoury Admin B: user ${user.id} has no ${
            norm ? 'NUID' : 'email'
          }`,
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
      failed = true;
      if (this.logFailure('B', e))
        bugs.push(
          Object.assign(new Error('Khoury Admin B failed'), { cause: e }),
        );
    }
    if (bugs.length === 1) throw bugs[0];
    if (bugs.length > 1)
      // NOTE: a plain Error with an `errors` list (AggregateError is missing from the es2017 lib typings); the hook logs it (messages and stacks only)
      throw Object.assign(new Error('Khoury Admin A and B failed'), {
        errors: bugs,
      });
    return !failed;
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

  // A failed call keeps what OH already has. A KhouryAdminError only warns; returns true for any other error, which the caller keeps and rethrows (the hook logs it)
  private logFailure(which: string, e: unknown): boolean {
    if (!(e instanceof KhouryAdminError)) return true;
    this.logger.warn(`Khoury Admin ${which} failed: ${e.message}`);
    return false;
  }
}
