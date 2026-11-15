import { Role } from '@koh/common';
import { ConsoleLogger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  ) {}

  async onSignIn(
    email: string,
    name: { first: string; last: string },
  ): Promise<UserModel> {
    const norm = normalizeEmail(email);
    let user = await UserModel.createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: norm })
      .getOne();
    if (!user) {
      user = await UserModel.create({
        email: norm,
        firstName: name.first,
        lastName: name.last,
      }).save();
    }
    // NOTE: single semester from env; must be bumped each term and profs can't see next term early; compute from date when going live
    const semester = this.config.get('KHOURY_SEMESTER');

    try {
      const a = await this.client.getSectionGroups(norm, semester);
      await this.saveSectionGroups(user, a.section_groups, semester);
    } catch (e) {
      this.logFailure('A', e);
    }
    try {
      const b = await this.client.getCourses(norm, semester);
      // NOTE: duplicate entries for one group collapse to the highest role
      const best = new Map<string, Role>();
      for (const c of b.courses) {
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
    const row = await ProfSectionGroupsModel.findOne({
      where: { profId: user.id },
    });
    if (!row && groups.length === 0) return;
    const sectionGroups = groups.map((g) => ({ ...g, semester }));
    await ProfSectionGroupsModel.create({
      ...row,
      profId: user.id,
      sectionGroups,
    }).save();

    for (const g of groups) {
      for (const crn of g.crns) {
        const course = await this.loginCourse.courseCRNToCourse(crn, semester);
        if (!course) continue;
        // NOTE: conditional update; the unique index turns "another course holds this id" (or a race) into a 23505 we skip
        try {
          await CourseModel.createQueryBuilder()
            .update()
            .set({ khourySectionGroupId: g.id })
            .where('id = :id AND "khourySectionGroupId" IS NULL', {
              id: course.id,
            })
            .execute();
        } catch (e) {
          if (e?.driverError?.code !== '23505') throw e;
        }
        break;
      }
    }
  }

  private async upsertMembership(userId: number, courseId: number, role: Role) {
    const uc = await UserCourseModel.findOne({ where: { userId, courseId } });
    if (!uc) {
      await UserCourseModel.create({ userId, courseId, role }).save();
      return;
    }
    // NOTE: self-enroll placeholder (override+expires) upgrades and becomes permanent; manual pin (override only) keeps its role, same role clears the flag; normal row upgrades and loses expires
    let changed = false;
    const pin = uc.override && !uc.expires;
    if (pin) {
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
    if (changed) await uc.save();
  }

  // A failed call keeps what OH already has; anything else is a real bug
  private logFailure(which: string, e: unknown) {
    if (!(e instanceof KhouryAdminError)) throw e;
    this.logger.warn(`Khoury Admin ${which} failed: ${e.message}`);
  }
}
