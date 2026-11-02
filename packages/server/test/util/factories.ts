import { QuestionGroupModel } from 'question/question-group.entity';
import { AlertType, QuestionType, Role, OpenQuestionStatus } from '@koh/common';
import { AlertModel } from 'alerts/alerts.entity';
import { EventModel, EventType } from 'profile/event-model.entity';
import { CourseModel } from '../../src/course/course.entity';
import { SemesterModel } from '../../src/semester/semester.entity';
import { CourseSectionMappingModel } from '../../src/login/course-section-mapping.entity';
import { UserCourseModel } from '../../src/profile/user-course.entity';
import { UserModel } from '../../src/profile/user.entity';
import { QuestionModel } from '../../src/question/question.entity';
import { QueueModel } from '../../src/queue/queue.entity';
import { LastRegistrationModel } from 'login/last-registration-model.entity';
import { ProfSectionGroupsModel } from 'login/prof-section-groups.entity';

import { BaseEntity, DeepPartial } from 'typeorm';

export function defineFactory<T extends BaseEntity>(Model: new () => T) {
  return (
    defaults: (
      overrides: DeepPartial<T>,
    ) => Promise<DeepPartial<T>> | DeepPartial<T>,
  ) => ({
    async create(overrides?: DeepPartial<T>): Promise<T> {
      const o = overrides ?? ({} as DeepPartial<T>);
      const base = await defaults(o);
      const entity = (Model as any).create({ ...base, ...o }) as T;
      return entity.save();
    },
    async createList(count: number, overrides?: DeepPartial<T>): Promise<T[]> {
      const out: T[] = [];
      for (let i = 0; i < count; i++) out.push(await this.create(overrides));
      return out;
    },
  });
}

export const UserFactory = defineFactory(UserModel)(() => {
  const defaults: DeepPartial<UserModel> = {
    email: 'user@neu.edu',
    firstName: 'User',
    lastName: 'Person',
    hideInsights: [],
  };
  return defaults;
});

export const StudentCourseFactory = defineFactory(UserCourseModel)(() => {
  const defaults: DeepPartial<UserCourseModel> = {
    role: Role.STUDENT,
  };
  return defaults;
});

export const TACourseFactory = defineFactory(UserCourseModel)(() => {
  const defaults: DeepPartial<UserCourseModel> = {
    role: Role.TA,
  };
  return defaults;
});

export const SemesterFactory = defineFactory(SemesterModel)(() => {
  const defaults: DeepPartial<SemesterModel> = {
    season: 'Fall',
    year: 2020,
  };
  return defaults;
});

export const CourseFactory = defineFactory(CourseModel)(async (o) => {
  const defaults: DeepPartial<CourseModel> = {
    name: 'CS 2500', // copy each value from the existing factory
    icalURL:
      'https://calendar.google.com/calendar/ical/t6lu2pic7u9otrbpkuk26sl34g%40group.calendar.google.com/public/basic.ics',
    sectionGroupName: 'CS 2500',
    enabled: true,
  };
  if (!o.semester && !o.semesterId)
    defaults.semester = await SemesterFactory.create();
  return defaults;
});

export const CourseSectionFactory = defineFactory(CourseSectionMappingModel)(
  async (o) => {
    const defaults: DeepPartial<CourseSectionMappingModel> = {
      crn: 12345,
    };
    if (!o.course && !o.courseId)
      defaults.course = await CourseFactory.create();
    return defaults;
  },
);

export const UserCourseFactory = defineFactory(UserCourseModel)(async (o) => {
  const defaults: DeepPartial<UserCourseModel> = {
    role: Role.STUDENT,
    override: false,
  };
  if (!o.user && !o.userId) defaults.user = await UserFactory.create();
  if (!o.course && !o.courseId) defaults.course = await CourseFactory.create();
  return defaults;
});

export const QueueFactory = defineFactory(QueueModel)(async (o) => {
  const defaults: DeepPartial<QueueModel> = {
    room: 'online',
    allowQuestions: false,
    isProfessorQueue: false,
    isDisabled: false,
    staffList: [],
  };
  if (!o.course && !o.courseId) defaults.course = await CourseFactory.create();
  return defaults;
});

// WARNING: DO NOT USE CREATORID. AS YOU SEE HERE, WE ONLY ACCEPT CREATOR
//TODO: make it accept creatorId as well
export const QuestionFactory = defineFactory(QuestionModel)(async (o) => {
  const defaults: DeepPartial<QuestionModel> = {
    text: 'question description', // copy each value from the existing factory
    status: OpenQuestionStatus.Queued,
    questionType: QuestionType.Other,
    groupable: true,
    createdAt: new Date('2020-11-02T12:00:00.000Z'),
  };
  if (!o.queue && !o.queueId) defaults.queue = await QueueFactory.create();
  if (!o.creator && !o.creatorId) defaults.creator = await UserFactory.create();
  return defaults;
});

export const QuestionGroupFactory = defineFactory(QuestionGroupModel)(
  async (o) => {
    const defaults: DeepPartial<QuestionGroupModel> = {};
    if (!o.creator && !o.creatorId)
      defaults.creator = await UserCourseFactory.create();

    if (!o.queue && !o.queueId) defaults.queue = await QueueFactory.create();
    return defaults;
  },
);

export const EventFactory = defineFactory(EventModel)(async (o) => {
  const defaults: DeepPartial<EventModel> = {
    time: new Date(),
    eventType: EventType.TA_CHECKED_IN,
  };
  if (!o.user && !o.userId) defaults.user = await UserFactory.create();
  if (!o.course && !o.courseId) defaults.course = await CourseFactory.create();
  return defaults;
});

export const LastRegistrationFactory = defineFactory(LastRegistrationModel)(
  async (o) => {
    const defaults: DeepPartial<LastRegistrationModel> = {
      lastRegisteredSemester: '202110',
    };
    if (!o.prof && !o.profId) defaults.prof = await UserFactory.create();
    return defaults;
  },
);

export const ProfSectionGroupsFactory = defineFactory(ProfSectionGroupsModel)(
  async (o) => {
    const defaults: DeepPartial<ProfSectionGroupsModel> = {
      sectionGroups: [],
    };
    if (!o.prof && !o.profId) defaults.prof = await UserFactory.create();
    return defaults;
  },
);

export const AlertFactory = defineFactory(AlertModel)(async (o) => {
  const defaults: DeepPartial<AlertModel> = {
    alertType: AlertType.REPHRASE_QUESTION,
    sent: new Date(Date.now() - 86400000),
    payload: {},
  };
  if (!o.user && !o.userId) defaults.user = await UserFactory.create();
  if (!o.course && !o.courseId) defaults.course = await CourseFactory.create();
  return defaults;
});
