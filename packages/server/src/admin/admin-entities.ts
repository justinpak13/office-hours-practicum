import { AdminEntity } from 'nestjs-admin';
import { Brackets } from 'typeorm';
import { Role } from '@koh/common';
import { CourseModel } from '../course/course.entity';
import { QueueModel } from '../queue/queue.entity';
import { UserModel } from '../profile/user.entity';
import { CourseSectionMappingModel } from '../login/course-section-mapping.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { SemesterModel } from 'semester/semester.entity';

export class CourseAdmin extends AdminEntity {
  entity = CourseModel;
  listDisplay = ['id', 'name', 'semesterId', 'enabled'];
  searchFields = ['name'];
  resultsPerPage = 50;
  fields = ['id', 'name', 'icalURL', 'semesterId', 'enabled', 'timezone'];

  // Search matches course name, semester season, or semester year
  async getEntityList(
    page: number,
    searchString: string,
  ): Promise<{ entities: unknown[]; count: number }> {
    const query = this.repository
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.semester', 'semester')
      .orderBy('course.semesterId', 'DESC', 'NULLS LAST')
      .addOrderBy('course.name', 'ASC')
      .skip(this.resultsPerPage * (page - 1))
      .take(this.resultsPerPage);
    if (searchString) {
      searchString
        .split(' ')
        .filter(Boolean)
        .forEach((term, i) => {
          query.andWhere(
            new Brackets((qb) => {
              qb.where(`course.name ILIKE :term${i}`, {
                [`term${i}`]: `%${term}%`,
              }).orWhere(`semester.season ILIKE :term${i}`);
              if (/^\d+$/.test(term)) {
                qb.orWhere(`semester.year = :year${i}`, {
                  [`year${i}`]: Number(term),
                });
              }
            }),
          );
        });
    }
    const [entities, count] = await query.getManyAndCount();
    for (const course of entities as CourseModel[]) {
      if (course.semester) {
        (course as any).semesterId = `${course.semester.season} ${course.semester.year} (#${course.semester.id})`;
      }
    }
    return { entities, count };
  }
}

export class QueueAdmin extends AdminEntity {
  entity = QueueModel;
  listDisplay = ['id', 'room', 'courseId'];
}

export class UserAdmin extends AdminEntity {
  entity = UserModel;
  listDisplay = ['id', 'email', 'firstName', 'lastName'];
  searchFields = ['email', 'firstName', 'lastName'];
  fields = [
    'id',
    'email',
    'firstName',
    'lastName',
    'desktopNotifsEnabled',
    'phoneNotifsEnabled',
    'queues',
  ];
}

export class UserCourseAdmin extends AdminEntity {
  entity = UserCourseModel;
  listDisplay = ['id', 'userId', 'courseId', 'role'];
  // Enables the search box; the actual search logic lives in getEntityList
  searchFields = ['role'];
  resultsPerPage = 50;

  // Search: a number matches the course id, student/ta/professor matches the
  // role, anything else matches user name/email or course name. Terms are
  // ANDed, so "367 ta" lists the TAs of course 367.
  async getEntityList(
    page: number,
    searchString: string,
  ): Promise<{ entities: unknown[]; count: number }> {
    const query = this.repository
      .createQueryBuilder('uc')
      .leftJoinAndSelect('uc.user', 'user')
      .leftJoinAndSelect('uc.course', 'course')
      .leftJoinAndSelect('course.semester', 'semester')
      .orderBy('uc.courseId', 'DESC', 'NULLS LAST')
      .addOrderBy('uc.role', 'ASC')
      .addOrderBy('user.lastName', 'ASC')
      .skip(this.resultsPerPage * (page - 1))
      .take(this.resultsPerPage);
    if (searchString) {
      const roles = Object.values(Role) as string[];
      searchString
        .split(' ')
        .filter(Boolean)
        .forEach((term, i) => {
          query.andWhere(
            new Brackets((qb) => {
              if (/^\d+$/.test(term)) {
                qb.where(`uc.courseId = :course${i}`, {
                  [`course${i}`]: Number(term),
                });
              } else if (roles.includes(term.toLowerCase())) {
                qb.where(`uc.role = :role${i}`, {
                  [`role${i}`]: term.toLowerCase(),
                });
              } else {
                qb.where(`user.firstName ILIKE :term${i}`, {
                  [`term${i}`]: `%${term}%`,
                })
                  .orWhere(`user.lastName ILIKE :term${i}`)
                  .orWhere(`user.email ILIKE :term${i}`)
                  .orWhere(`course.name ILIKE :term${i}`);
              }
            }),
          );
        });
    }
    const [entities, count] = await query.getManyAndCount();
    for (const uc of entities as UserCourseModel[]) {
      if (uc.user) {
        (uc as any).userId = `${uc.user.firstName} ${uc.user.lastName} <${uc.user.email}> (#${uc.user.id})`;
      }
      if (uc.course) {
        const semester = uc.course.semester
          ? ` — ${uc.course.semester.season} ${uc.course.semester.year}`
          : '';
        (uc as any).courseId = `${uc.course.name}${semester} (#${uc.course.id})`;
      }
    }
    return { entities, count };
  }
}

export class CourseSectionMappingAdmin extends AdminEntity {
  entity = CourseSectionMappingModel;
  listDisplay = ['id', 'crn', 'courseId'];
}

export class SemesterAdmin extends AdminEntity {
  entity = SemesterModel;
  listDisplay = ['id', 'season', 'year'];
}
