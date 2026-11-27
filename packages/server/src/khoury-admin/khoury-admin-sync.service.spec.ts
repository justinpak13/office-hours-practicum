import { Role } from '@koh/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { CourseModel } from '../course/course.entity';
import { LoginCourseService } from '../login/login-course.service';
import { CourseSectionMappingModel } from '../login/course-section-mapping.entity';
import { ProfSectionGroupsModel } from '../login/prof-section-groups.entity';
import { UserCourseModel } from '../profile/user-course.entity';
import { UserModel } from '../profile/user.entity';
import {
  CourseFactory,
  SemesterFactory,
  UserCourseFactory,
  UserFactory,
} from '../../test/util/factories';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import {
  higherRole,
  KhouryAdminSyncService,
  khouryRoleToRole,
  normalizeEmail,
} from './khoury-admin-sync.service';
import { KhouryAdminClient } from './khoury-admin.client';
import { KhouryAdminError } from './khoury-admin.types';

describe('KhouryAdminSyncService', () => {
  let service: KhouryAdminSyncService;
  let conn: DataSource;
  const client = { getSectionGroups: jest.fn(), getCourses: jest.fn() };
  const name = { first: 'Jane', last: 'Doe' };
  const sem = '202710'; // Fall 2026, matches KHOURY_SEMESTER in .env.test

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule],
      providers: [
        KhouryAdminSyncService,
        LoginCourseService,
        ConfigService,
        { provide: KhouryAdminClient, useValue: client },
      ],
    }).compile();
    service = module.get(KhouryAdminSyncService);
    conn = module.get(DataSource);
  });
  afterAll(() => conn.destroy());
  beforeEach(async () => {
    await conn.synchronize(true);
    client.getSectionGroups.mockReset().mockResolvedValue({
      semester: sem,
      section_groups: [],
    });
    client.getCourses.mockReset().mockResolvedValue({
      semester: sem,
      courses: [],
    });
  });

  const fall2026 = () => SemesterFactory.create({ season: 'Fall', year: 2026 });

  it('normalizeEmail, roles and higherRole', () => {
    expect(normalizeEmail('Rivera.Jo@Husky.NEU.edu')).toBe(
      'rivera.jo@northeastern.edu',
    );
    expect(khouryRoleToRole('TA')).toBe(Role.TA);
    expect(higherRole(Role.TA, Role.STUDENT)).toBe(Role.TA);
    expect(higherRole(Role.TA, Role.PROFESSOR)).toBe(Role.PROFESSOR);
  });

  it('matches an existing user case-insensitively; creates a new one', async () => {
    const u = await UserFactory.create({ email: 'Rivera.Jo@Northeastern.edu' });
    const same = await service.onSignIn('rivera.jo@HUSKY.neu.edu', name);
    expect(same.id).toBe(u.id);
    expect(await UserModel.count()).toBe(1);

    const fresh = await service.onSignIn('new.p@northeastern.edu', name);
    expect(fresh.email).toBe('new.p@northeastern.edu');
    expect(fresh.firstName).toBe('Jane');
    expect(fresh.lastName).toBe('Doe');
    expect(await UserModel.count()).toBe(2);
  });

  it('saves A into ProfSectionGroupsModel; no row for an empty result', async () => {
    const u = await UserFactory.create({ email: 'p@northeastern.edu' });
    await service.onSignIn('p@northeastern.edu', name);
    expect(await ProfSectionGroupsModel.count()).toBe(0);

    client.getSectionGroups.mockResolvedValue({
      semester: sem,
      section_groups: [{ id: 'sg_1', name: 'CS 1', crns: [11, 12] }],
    });
    await service.onSignIn('p@northeastern.edu', name);
    const row = await ProfSectionGroupsModel.findOneBy({ profId: u.id });
    expect(row.sectionGroups).toEqual([
      { id: 'sg_1', name: 'CS 1', crns: [11, 12], semester: sem },
    ]);
    await service.onSignIn('p@northeastern.edu', name);
    expect(await ProfSectionGroupsModel.count()).toBe(1);
  });

  describe('CRN linking', () => {
    const groups = (id: string) => ({
      semester: sem,
      section_groups: [{ id, name: 'CS 1', crns: [11, 12] }],
    });
    const mapped = async (extra = {}) => {
      const course = await CourseFactory.create({
        semester: await fall2026(),
        ...extra,
      });
      await CourseSectionMappingModel.create({
        crn: 12,
        courseId: course.id,
      }).save();
      return course;
    };

    it('links a course with null id by CRN', async () => {
      const course = await mapped();
      client.getSectionGroups.mockResolvedValue(groups('sg_1'));
      await service.onSignIn('p@northeastern.edu', name);
      expect(
        (await CourseModel.findOneBy({ id: course.id })).khourySectionGroupId,
      ).toBe('sg_1');
    });

    it('skips when another course already holds the id', async () => {
      await CourseFactory.create({ khourySectionGroupId: 'sg_1' });
      const course = await mapped();
      client.getSectionGroups.mockResolvedValue(groups('sg_1'));
      await service.onSignIn('p@northeastern.edu', name);
      expect(
        (await CourseModel.findOneBy({ id: course.id })).khourySectionGroupId,
      ).toBeNull();
    });
  });

  describe('B memberships', () => {
    const b = (role: string, id = 'sg_1') =>
      client.getCourses.mockResolvedValue({
        semester: sem,
        courses: [{ section_group_id: id, role }],
      });

    it('creates a missing membership', async () => {
      const course = await CourseFactory.create({
        khourySectionGroupId: 'sg_1',
      });
      b('TA');
      const u = await service.onSignIn('s@northeastern.edu', name);
      const uc = await UserCourseModel.findOneBy({
        userId: u.id,
        courseId: course.id,
      });
      expect(uc.role).toBe(Role.TA);
    });

    it('upgrades but never downgrades', async () => {
      const course = await CourseFactory.create({
        khourySectionGroupId: 'sg_1',
      });
      const u = await UserFactory.create({ email: 's@northeastern.edu' });
      const uc = await UserCourseFactory.create({
        user: u,
        course,
        role: Role.STUDENT,
      });
      b('TA');
      await service.onSignIn('s@northeastern.edu', name);
      expect((await UserCourseModel.findOneBy({ id: uc.id })).role).toBe(
        Role.TA,
      );
      b('Student');
      await service.onSignIn('s@northeastern.edu', name);
      expect((await UserCourseModel.findOneBy({ id: uc.id })).role).toBe(
        Role.TA,
      );
    });

    it('skips groups with no course or a disabled course', async () => {
      await CourseFactory.create({
        khourySectionGroupId: 'sg_off',
        enabled: false,
      });
      client.getCourses.mockResolvedValue({
        semester: sem,
        courses: [
          { section_group_id: 'sg_off', role: 'Student' },
          { section_group_id: 'sg_none', role: 'Student' },
        ],
      });
      await service.onSignIn('s@northeastern.edu', name);
      expect(await UserCourseModel.count()).toBe(0);
    });
  });

  it('logs KhouryAdminError from A or B, leaves courses, returns the user', async () => {
    const course = await CourseFactory.create({ khourySectionGroupId: 'sg_1' });
    const u = await UserFactory.create({ email: 's@northeastern.edu' });
    const uc = await UserCourseFactory.create({
      user: u,
      course,
      role: Role.TA,
    });
    client.getSectionGroups.mockRejectedValue(new KhouryAdminError('down'));
    client.getCourses.mockRejectedValue(new KhouryAdminError('down'));
    const res = await service.onSignIn('s@northeastern.edu', name);
    expect(res.id).toBe(u.id);
    expect(await UserCourseModel.count()).toBe(1);
    expect((await UserCourseModel.findOneBy({ id: uc.id })).role).toBe(Role.TA);
  });

  it('keeps the A row and still applies B when A fails', async () => {
    const u = await UserFactory.create({ email: 's@northeastern.edu' });
    const rows = [{ id: 'sg_old', name: 'Old', crns: [1], semester: sem }];
    await ProfSectionGroupsModel.create({
      profId: u.id,
      sectionGroups: rows,
    }).save();
    const course = await CourseFactory.create({ khourySectionGroupId: 'sg_1' });
    client.getSectionGroups.mockRejectedValue(new KhouryAdminError('down'));
    client.getCourses.mockResolvedValue({
      semester: sem,
      courses: [{ section_group_id: 'sg_1', role: 'TA' }],
    });
    await service.onSignIn('s@northeastern.edu', name);
    expect(
      (await ProfSectionGroupsModel.findOneBy({ profId: u.id })).sectionGroups,
    ).toEqual(rows);
    expect(
      (await UserCourseModel.findOneBy({ userId: u.id, courseId: course.id }))
        .role,
    ).toBe(Role.TA);
  });

  it('starts A and B together, before either resolves', async () => {
    await UserFactory.create({ email: 's@northeastern.edu' });
    let releaseA: () => void;
    client.getSectionGroups.mockReturnValue(
      new Promise((r) => {
        releaseA = () => r({ semester: sem, section_groups: [] });
      }),
    );
    const done = service.onSignIn('s@northeastern.edu', name);
    await new Promise((r) => setTimeout(r, 50));
    expect(client.getSectionGroups).toHaveBeenCalledTimes(1);
    expect(client.getCourses).toHaveBeenCalledTimes(1);
    releaseA();
    await done;
  });

  it('keeps A saved and does not throw when B fails', async () => {
    const u = await UserFactory.create({ email: 's@northeastern.edu' });
    client.getSectionGroups.mockResolvedValue({
      semester: sem,
      section_groups: [{ id: 'sg_1', name: 'N', crns: [1] }],
    });
    client.getCourses.mockRejectedValue(new KhouryAdminError('down'));
    await service.onSignIn('s@northeastern.edu', name);
    expect(
      (await ProfSectionGroupsModel.findOneBy({ profId: u.id })).sectionGroups,
    ).toHaveLength(1);
  });

  it('a KhouryAdminError rejection from A is logged and B is still applied', async () => {
    const u = await UserFactory.create({ email: 's@northeastern.edu' });
    const course = await CourseFactory.create({ khourySectionGroupId: 'sg_1' });
    client.getSectionGroups.mockImplementation(async () => {
      throw new KhouryAdminError('bad');
    });
    client.getCourses.mockResolvedValue({
      semester: sem,
      courses: [{ section_group_id: 'sg_1', role: 'TA' }],
    });
    await service.onSignIn('s@northeastern.edu', name);
    expect(
      (await UserCourseModel.findOneBy({ userId: u.id, courseId: course.id }))
        .role,
    ).toBe(Role.TA);
  });

  it('swallows the unique violation when linking a held id', async () => {
    const x = await CourseFactory.create({
      semester: await fall2026(),
      khourySectionGroupId: 'sg_120271000000000001',
    });
    const y = await CourseFactory.create({ semester: x.semester });
    await CourseSectionMappingModel.create({ crn: 7, courseId: y.id }).save();
    client.getSectionGroups.mockResolvedValue({
      semester: sem,
      section_groups: [{ id: 'sg_120271000000000001', name: 'CS', crns: [7] }],
    });
    await expect(
      service.onSignIn('p@northeastern.edu', name),
    ).resolves.toBeDefined();
    expect(
      (await CourseModel.findOneBy({ id: y.id })).khourySectionGroupId,
    ).toBeNull();
    expect(
      (await CourseModel.findOneBy({ id: x.id })).khourySectionGroupId,
    ).toBe('sg_120271000000000001');
  });

  describe('override and expires rows', () => {
    const run = async (
      row: { role: Role; override?: boolean; expires?: boolean },
      bRole: string,
    ) => {
      const course = await CourseFactory.create({
        khourySectionGroupId: 'sg_1',
      });
      const u = await UserFactory.create({ email: 's@northeastern.edu' });
      const uc = await UserCourseFactory.create({ user: u, course, ...row });
      client.getCourses.mockResolvedValue({
        semester: sem,
        courses: [{ section_group_id: 'sg_1', role: bRole }],
      });
      await service.onSignIn('s@northeastern.edu', name);
      return UserCourseModel.findOneBy({ id: uc.id });
    };

    it('override Student row, B says TA: role and flag unchanged', async () => {
      const uc = await run({ role: Role.STUDENT, override: true }, 'TA');
      expect([uc.role, uc.override]).toEqual([Role.STUDENT, true]);
    });

    it('override TA row, B says TA: flag cleared', async () => {
      const uc = await run({ role: Role.TA, override: true }, 'TA');
      expect([uc.role, uc.override]).toEqual([Role.TA, false]);
    });

    it('self-enroll row, B says Student: both flags cleared', async () => {
      const uc = await run(
        { role: Role.STUDENT, override: true, expires: true },
        'Student',
      );
      expect([uc.role, uc.override, uc.expires]).toEqual([
        Role.STUDENT,
        false,
        false,
      ]);
    });

    it('self-enroll row, B says TA: upgraded, both flags cleared', async () => {
      const uc = await run(
        { role: Role.STUDENT, override: true, expires: true },
        'TA',
      );
      expect([uc.role, uc.override, uc.expires]).toEqual([
        Role.TA,
        false,
        false,
      ]);
    });

    it('normal expiring row, B says TA: upgraded and permanent', async () => {
      const uc = await run({ role: Role.STUDENT, expires: true }, 'TA');
      expect([uc.role, uc.expires]).toEqual([Role.TA, false]);
    });

    it('duplicate B entries on a manual pin: role and flag unchanged', async () => {
      const course = await CourseFactory.create({
        khourySectionGroupId: 'sg_120271000000000001',
      });
      const u = await UserFactory.create({ email: 's@northeastern.edu' });
      const uc = await UserCourseFactory.create({
        user: u,
        course,
        role: Role.STUDENT,
        override: true,
      });
      client.getCourses.mockResolvedValue({
        semester: sem,
        courses: [
          { section_group_id: 'sg_120271000000000001', role: 'Student' },
          { section_group_id: 'sg_120271000000000001', role: 'TA' },
        ],
      });
      await service.onSignIn('s@northeastern.edu', name);
      const row = await UserCourseModel.findOneBy({ id: uc.id });
      expect([row.role, row.override]).toEqual([Role.STUDENT, true]);
    });

    it('duplicate B entries with no row: one TA membership', async () => {
      await CourseFactory.create({
        khourySectionGroupId: 'sg_120271000000000001',
      });
      client.getCourses.mockResolvedValue({
        semester: sem,
        courses: [
          { section_group_id: 'sg_120271000000000001', role: 'Student' },
          { section_group_id: 'sg_120271000000000001', role: 'TA' },
        ],
      });
      await service.onSignIn('s@northeastern.edu', name);
      const rows = await UserCourseModel.find();
      expect(rows.map((r) => r.role)).toEqual([Role.TA]);
    });
  });

  describe('concurrency and CRN fallthrough', () => {
    it('tries the next CRN when the first course belongs to another group', async () => {
      const semester = await fall2026();
      const x = await CourseFactory.create({
        semester,
        khourySectionGroupId: 'sg_other',
      });
      const y = await CourseFactory.create({ semester });
      await CourseSectionMappingModel.create({ crn: 1, courseId: x.id }).save();
      await CourseSectionMappingModel.create({ crn: 2, courseId: y.id }).save();
      client.getSectionGroups.mockResolvedValue({
        semester: sem,
        section_groups: [{ id: 'sg_1', name: 'CS', crns: [1, 2] }],
      });
      await service.onSignIn('p@northeastern.edu', name);
      expect(
        (await CourseModel.findOneBy({ id: y.id })).khourySectionGroupId,
      ).toBe('sg_1');
      expect(
        (await CourseModel.findOneBy({ id: x.id })).khourySectionGroupId,
      ).toBe('sg_other');
    });

    it('concurrent first sign-ins of a professor leave one row with A groups', async () => {
      client.getSectionGroups.mockResolvedValue({
        semester: sem,
        section_groups: [{ id: 'sg_1', name: 'CS', crns: [1] }],
      });
      const [a, b] = await Promise.all([
        service.onSignIn('p@northeastern.edu', name),
        service.onSignIn('p@northeastern.edu', name),
      ]);
      expect(a.id).toBe(b.id);
      const rows = await ProfSectionGroupsModel.find();
      expect(rows).toHaveLength(1);
      expect(rows[0].sectionGroups).toEqual([
        { id: 'sg_1', name: 'CS', crns: [1], semester: sem },
      ]);
    });

    it('concurrent sign-ins of a new email create one user', async () => {
      await Promise.all([
        service.onSignIn('new@northeastern.edu', name),
        service.onSignIn('New@Husky.neu.edu', name),
      ]);
      expect(await UserModel.count()).toBe(1);
    });

    it('returns an existing row with the exact normalized email without inserting', async () => {
      const existing = await UserFactory.create({
        email: 'old@northeastern.edu',
      });
      const u = await service.onSignIn('Old@Husky.neu.edu', name);
      expect(u.id).toBe(existing.id);
      expect(await UserModel.count()).toBe(1);
    });

    it('insert hits ON CONFLICT DO NOTHING when the first lookup misses', async () => {
      const existing = await UserFactory.create({
        email: 'race@northeastern.edu',
      });
      const spy = jest
        .spyOn(SelectQueryBuilder.prototype, 'getOne')
        .mockResolvedValueOnce(null);
      try {
        const u = await service.onSignIn('race@northeastern.edu', name);
        expect(u.id).toBe(existing.id);
      } finally {
        spy.mockRestore();
      }
      expect(await UserModel.count()).toBe(1);
    });

    it('never matches a Keycloak user with the same email; creates a legacy row', async () => {
      const kc = await UserFactory.create({
        email: 's@northeastern.edu',
        keycloakSub: 'sub-1',
      });
      const course = await CourseFactory.create({
        khourySectionGroupId: 'sg_1',
      });
      client.getCourses.mockResolvedValue({
        semester: sem,
        courses: [{ section_group_id: 'sg_1', role: 'Student' }],
      });
      const u = await service.onSignIn('s@northeastern.edu', name);
      expect(u.id).not.toBe(kc.id);
      expect(u.keycloakSub).toBeNull();
      expect(await UserModel.count()).toBe(2);
      expect(await UserCourseModel.countBy({ userId: kc.id })).toBe(0);
      expect(
        await UserCourseModel.countBy({ userId: u.id, courseId: course.id }),
      ).toBe(1);
    });

    it('DB rejects a second legacy user with the same email', async () => {
      await UserFactory.create({ email: 'dup@northeastern.edu' });
      await expect(
        UserFactory.create({ email: 'dup@northeastern.edu' }),
      ).rejects.toMatchObject({ driverError: { code: '23505' } });
    });

    it('concurrent sign-ins create one membership', async () => {
      await UserFactory.create({ email: 's@northeastern.edu' });
      await CourseFactory.create({ khourySectionGroupId: 'sg_1' });
      client.getCourses.mockResolvedValue({
        semester: sem,
        courses: [{ section_group_id: 'sg_1', role: 'Student' }],
      });
      await Promise.all([
        service.onSignIn('s@northeastern.edu', name),
        service.onSignIn('s@northeastern.edu', name),
      ]);
      expect(await UserCourseModel.count()).toBe(1);
    });
  });
});
