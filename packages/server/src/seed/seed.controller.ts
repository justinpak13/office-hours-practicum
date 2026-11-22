import { Role } from '@koh/common';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AlertModel } from 'alerts/alerts.entity';
import { CourseSectionMappingModel } from 'login/course-section-mapping.entity';
import { LastRegistrationModel } from 'login/last-registration-model.entity';
import { ProfSectionGroupsModel } from 'login/prof-section-groups.entity';
import { DesktopNotifModel } from 'notification/desktop-notif.entity';
import { EventModel, EventType } from 'profile/event-model.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { UserModel } from 'profile/user.entity';
import { QuestionGroupModel } from 'question/question-group.entity';
import { SemesterModel } from 'semester/semester.entity';
import { DataSource, DeepPartial } from 'typeorm';
import {
  CourseFactory,
  EventFactory,
  QuestionFactory,
  QueueFactory,
  SemesterFactory,
  UserCourseFactory,
  UserFactory,
} from '../../test/util/factories';
import { CourseModel } from '../course/course.entity';
import { NonProductionGuard } from '../guards/non-production.guard';
import { QuestionModel } from '../question/question.entity';
import { QueueModel } from '../queue/queue.entity';
import { SeedService } from './seed.service';

// Keycloak IDs (`sub`) of the seeded users. They match the users with the
// same IDs in oauth2-proxy-demo/fake-keycloak/users.json, so picking one of
// them on the fake Keycloak's login page logs in as that seeded user.
export const SEED_KEYCLOAK_SUBS = {
  STUDENT_1: 'f6805507-a879-4a0f-88e5-9278dbecafc9',
  STUDENT_2: 'ca7e14a6-f00c-4639-adea-8b14cff50243',
  TA_1: '8c6459fe-aa17-43e4-a392-55cee123e13e',
  TA_2: 'e17bd22a-3a16-49ac-853f-6664fbf31a87',
  PROFESSOR: '8df5d97a-b65c-460e-b141-2a56600811c1',
};

@Controller('seeds')
@UseGuards(NonProductionGuard)
export class SeedController {
  constructor(
    private dataSource: DataSource,
    private seedService: SeedService,
  ) {}

  @Get('delete')
  async deleteAll(): Promise<string> {
    await this.seedService.deleteAll(LastRegistrationModel);
    await this.seedService.deleteAll(ProfSectionGroupsModel);
    await this.seedService.deleteAll(QuestionModel);
    await this.seedService.deleteAll(QuestionGroupModel);
    await this.seedService.deleteAll(QueueModel);
    await this.seedService.deleteAll(UserCourseModel);
    await this.seedService.deleteAll(EventModel);
    await this.seedService.deleteAll(DesktopNotifModel);
    await this.seedService.deleteAll(AlertModel);
    await this.seedService.deleteAll(UserModel);
    await this.seedService.deleteAll(CourseSectionMappingModel);
    await this.seedService.deleteAll(CourseModel);
    await this.seedService.deleteAll(SemesterModel);
    await this.dataSource.query(
      'ALTER SEQUENCE user_model_id_seq RESTART WITH 1;',
    );

    return 'Data successfully reset';
  }

  @Get('create')
  async createSeeds(): Promise<string> {
    // First delete the old data
    await this.deleteAll();

    // Then add the new seed data
    const now = new Date();

    const yesterday = new Date();
    yesterday.setUTCHours(now.getUTCHours() - 24);

    const tomorrow = new Date();
    tomorrow.setUTCHours(now.getUTCHours() + 19);

    const courseExists = await CourseModel.findOne({
      where: { name: 'CS 2500' },
    });
    if (!courseExists) {
      // possible collision:
      // If the dev env is active at midnight, the cron job will rescrape events from the ical which
      // synthetically creates events centered around your time.
      // But since the semester is centered in Fall 2020,
      // the events will get filtered out since they arent in that date.
      // you will need to reseed data!
      const semester = await SemesterFactory.create({
        season: 'Fall',
        year: 2020,
      });
      await CourseFactory.create({
        timezone: 'America/New_York',
        semesterId: semester.id,
      });
    }

    const course = await CourseModel.findOne({
      where: { name: 'CS 2500' },
    });

    const [userExists] = await UserModel.find({ take: 1 });
    if (!userExists) {
      // Student 1
      const user1 = await UserFactory.create({
        email: 'liu.sta@northeastern.edu',
        keycloakSub: SEED_KEYCLOAK_SUBS.STUDENT_1,
        firstName: 'Stanley',
        lastName: 'Liu',
      });
      await UserCourseFactory.create({
        user: user1,
        role: Role.STUDENT,
        course: course,
      });

      // Student 2
      const user2 = await UserFactory.create({
        email: 'takayama.a@northeastern.edu',
        keycloakSub: SEED_KEYCLOAK_SUBS.STUDENT_2,
        firstName: 'Alex',
        lastName: 'Takayama',
      });
      await UserCourseFactory.create({
        user: user2,
        role: Role.STUDENT,
        course: course,
        override: true,
      });

      // TA 1
      const user3 = await UserFactory.create({
        email: 'stenzel.w@northeastern.edu',
        keycloakSub: SEED_KEYCLOAK_SUBS.TA_1,
        firstName: 'Will',
        lastName: 'Stenzel',
      });
      await UserCourseFactory.create({
        user: user3,
        role: Role.TA,
        course: course,
      });
      // TA 2
      const user4 = await UserFactory.create({
        email: 'chu.daj@northeastern.edu',
        keycloakSub: SEED_KEYCLOAK_SUBS.TA_2,
        firstName: 'Da-Jin',
        lastName: 'Chu',
      });
      await UserCourseFactory.create({
        user: user4,
        role: Role.TA,
        course: course,
      });
      // Professor (Snarky!!)
      const user5 = await UserFactory.create({
        email: 'li.edwa@northeastern.edu',
        keycloakSub: SEED_KEYCLOAK_SUBS.PROFESSOR,
        firstName: 'Eddy',
        lastName: 'Li',
        photoURL:
          'https://ca.slack-edge.com/TE565NU79-UR6P32JBT-a6c89822c544-512',
        insights: [
          'QuestionTypeBreakdown',
          'TotalQuestionsAsked',
          'TotalStudents',
        ],
      });
      await UserCourseFactory.create({
        user: user5,
        role: Role.PROFESSOR,
        course: course,
      });
    }

    const queue = await QueueFactory.create({
      room: 'Online',
      course: course,
      allowQuestions: true,
    });

    await QuestionFactory.create({
      queue: queue,
      createdAt: new Date(Date.now() - 3500000),
    });
    await QuestionFactory.create({
      queue: queue,
      createdAt: new Date(Date.now() - 2500000),
    });
    await QuestionFactory.create({
      queue: queue,
      createdAt: new Date(Date.now() - 1500000),
    });

    const eventTA = await UserModel.findOne({
      where: {
        firstName: 'Will',
      },
    });

    await EventFactory.create({
      user: eventTA,
      course: course,
      time: yesterday,
      eventType: EventType.TA_CHECKED_IN,
    });

    await EventFactory.create({
      user: eventTA,
      course: course,
      time: new Date(Date.now() - 80000000),
      eventType: EventType.TA_CHECKED_OUT,
    });

    await EventFactory.create({
      user: eventTA,
      course: course,
      time: new Date(Date.now() - 70000000),
      eventType: EventType.TA_CHECKED_IN,
    });

    const todayAtMidnight = new Date();
    todayAtMidnight.setHours(0, 0, 0, 0);

    await EventFactory.create({
      user: eventTA,
      course: course,
      time: todayAtMidnight,
      eventType: EventType.TA_CHECKED_OUT_FORCED,
    });

    const professorQueue = await QueueFactory.create({
      room: "Professor Li's Hours",
      course: course,
      allowQuestions: true,
      isProfessorQueue: true,
    });

    await QuestionFactory.create({
      queue: professorQueue,
      createdAt: new Date(Date.now() - 1500000),
    });

    return 'Data successfully seeded';
  }

  @Get('fill_queue')
  async fillQueue(): Promise<string> {
    const [queue] = await QueueModel.find({ take: 1 });

    await QuestionFactory.create({
      queue: queue,
      createdAt: new Date(Date.now() - 1500000),
    });
    await QuestionFactory.create({
      queue: queue,
      createdAt: new Date(Date.now() - 1500000),
    });
    await QuestionFactory.create({
      queue: queue,
      createdAt: new Date(Date.now() - 1500000),
    });

    return 'Data successfully seeded';
  }

  // With `user`, the user is the one with that Keycloak `sub` (created if
  // needed), so logging in as that fake Keycloak user through oauth2-proxy
  // logs in as them. Their profile is set to match Keycloak's, because every
  // request copies it from the token.
  @Post('createUser')
  async createUser(
    @Body()
    body: {
      role: Role;
      courseId: number;
      user?: {
        keycloakSub: string;
        email: string;
        firstName?: string;
        lastName?: string;
        nuid?: string;
      };
    },
  ): Promise<UserCourseModel> {
    const options: DeepPartial<UserCourseModel> = { role: body.role };
    if (body.courseId) {
      options.course = await CourseModel.findOneOrFail({
        where: { id: body.courseId },
      });
    }
    if (body.user) {
      const profile = {
        email: body.user.email.toLowerCase(),
        firstName: body.user.firstName ?? null,
        lastName: body.user.lastName ?? null,
        nuid: body.user.nuid ?? null,
      };
      const existing = await UserModel.findOne({
        where: { keycloakSub: body.user.keycloakSub },
      });
      if (existing) {
        await UserModel.update(existing.id, profile);
        options.user = await UserModel.findOneOrFail({
          where: { id: existing.id },
        });
      } else {
        options.user = await UserFactory.create({
          ...profile,
          keycloakSub: body.user.keycloakSub,
        });
      }
    }
    return UserCourseFactory.create(options);
  }

  @Post('createQueue')
  async createQueue(
    @Body()
    body: {
      courseId: number;
      allowQuestions: boolean;
      // closes in n milliseconds from now
      closesIn?: number;
    },
  ): Promise<QueueModel> {
    const options = {
      allowQuestions: body.allowQuestions ?? false,
    };
    if (body.courseId) {
      const course = await CourseModel.findOneOrFail({
        where: { id: body.courseId },
      });
      options['course'] = course;
    }
    const queue: QueueModel = await QueueFactory.create(options);
    return queue;
  }

  @Post('createQuestion')
  async createQuestion(
    @Body()
    body: {
      queueId?: number;
      studentId?: number;
      data?: DeepPartial<QuestionModel>;
    } = {},
  ): Promise<QuestionModel> {
    const options = {};
    if (body.queueId) {
      const queue = await QueueModel.findOneOrFail({
        where: { id: body.queueId },
      });
      options['queue'] = queue;
    }
    if (body.studentId) {
      const student = await UserModel.findOneOrFail({
        where: { id: body.studentId },
      });
      options['creator'] = student;
    }
    const question: QuestionModel = await QuestionFactory.create({
      ...options,
      ...body.data,
      createdAt: new Date(),
    });
    return question;
  }

  @Post('createQueueWithoutOfficeHour')
  async createQueueWithoutOfficeHour(
    @Body()
    body: {
      courseId: number;
      allowQuestions: boolean;
    },
  ): Promise<QueueModel> {
    const options = {
      allowQuestions: body.allowQuestions ?? false,
      officeHours: [],
    };
    if (body.courseId) {
      const course = await CourseModel.findOneOrFail({
        where: { id: body.courseId },
      });
      options['course'] = course;
    }
    return await QueueFactory.create(options);
  }
}
