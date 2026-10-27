import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminResource } from './admin-resource';
import { Brackets } from 'typeorm';
import { Role } from '@koh/common';
import { CourseModel } from '../course/course.entity';
import { QueueModel } from '../queue/queue.entity';
import { UserModel } from '../profile/user.entity';
import { CourseSectionMappingModel } from '../login/course-section-mapping.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { SemesterModel } from 'semester/semester.entity';

@Injectable()
export class CourseAdmin extends AdminResource<CourseModel> {
  alias = 'course';
  listDisplay = ['id', 'name', 'semesterId', 'enabled'];
  searchFields = ['name'];
  resultsPerPage = 50;
  fields = ['id', 'name', 'icalURL', 'semesterId', 'enabled', 'timezone'];

  constructor(@InjectRepository(CourseModel) repo: Repository<CourseModel>) {
    super(repo);
  }

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
        (
          course as any
        ).semesterId = `${course.semester.season} ${course.semester.year} (#${course.semester.id})`;
      }
    }
    return { entities, count };
  }
}

@Injectable()
export class QueueAdmin extends AdminResource<QueueModel> {
  alias = 'queue';
  listDisplay = ['id', 'room', 'courseId'];

  constructor(@InjectRepository(QueueModel) repo: Repository<QueueModel>) {
    super(repo);
  }
}

@Injectable()
export class UserAdmin extends AdminResource<UserModel> {
  alias = 'user';
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

  constructor(@InjectRepository(UserModel) repo: Repository<UserModel>) {
    super(repo);
  }
}

@Injectable()
export class UserCourseAdmin extends AdminResource<UserCourseModel> {
  alias = 'user-course';
  listDisplay = ['id', 'userId', 'courseId', 'role'];
  // Enables the search box; the actual search logic lives in getEntityList
  searchFields = ['role'];
  resultsPerPage = 50;

  constructor(
    @InjectRepository(UserCourseModel) repo: Repository<UserCourseModel>,
  ) {
    super(repo);
  }

  // Search matches course name, semester season, or semester year
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
        (
          uc as any
        ).userId = `${uc.user.firstName} ${uc.user.lastName} <${uc.user.email}> (#${uc.user.id})`;
      }
      if (uc.course) {
        const semester = uc.course.semester
          ? ` — ${uc.course.semester.season} ${uc.course.semester.year}`
          : '';
        (
          uc as any
        ).courseId = `${uc.course.name}${semester} (#${uc.course.id})`;
      }
    }
    return { entities, count };
  }
}

@Injectable()
export class CourseSectionMappingAdmin extends AdminResource<CourseSectionMappingModel> {
  alias = 'course-section-mapping';
  listDisplay = ['id', 'room', 'courseId'];

  constructor(
    @InjectRepository(CourseSectionMappingModel)
    repo: Repository<CourseSectionMappingModel>,
  ) {
    super(repo);
  }
}

@Injectable()
export class SemesterAdmin extends AdminResource<SemesterModel> {
  alias = 'semester-model';
  listDisplay = ['id', 'season', 'year'];

  constructor(
    @InjectRepository(SemesterModel) repo: Repository<SemesterModel>,
  ) {
    super(repo);
  }
}
