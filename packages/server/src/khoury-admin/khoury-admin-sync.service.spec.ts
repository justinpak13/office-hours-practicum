import { Role } from '@koh/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
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
  const client = {
    getSectionGroups: jest.fn(),
    getCourses: jest.fn(),
    getRoster: jest.fn(),
  };
  const NUID = '001234567';
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
  let error: jest.SpyInstance;
  let warn: jest.SpyInstance;
  afterEach(() => jest.restoreAllMocks());
  beforeEach(async () => {
    error = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);
    warn = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);
    await conn.synchronize(true);
    client.getSectionGroups.mockReset().mockResolvedValue({
      semester: sem,
      section_groups: [],
    });
    client.getRoster.mockReset().mockResolvedValue(null);
    client.getCourses.mockReset().mockResolvedValue({
      semester: sem,
      courses: [],
    });
  });

  // sign in a legacy user by email, creating the row first when missing
  const signIn = async (email: string) => {
    const e = normalizeEmail(email);
    const user =
      (await UserModel.findOneBy({ email: e })) ??
      (await UserFactory.create({ nuid: NUID, email: e }));
    await service.onSignIn(user);
    return user;
  };

  const fall2026 = () => SemesterFactory.create({ season: 'Fall', year: 2026 });

  it('normalizeEmail, roles and higherRole', () => {
    expect(normalizeEmail('Rivera.Jo@Husky.NEU.edu')).toBe(
      'rivera.jo@northeastern.edu',
    );
    expect(khouryRoleToRole('TA')).toBe(Role.TA);
    expect(higherRole(Role.TA, Role.STUDENT)).toBe(Role.TA);
    expect(higherRole(Role.TA, Role.PROFESSOR)).toBe(Role.PROFESSOR);
  });

  it('saves A into ProfSectionGroupsModel; no row for an empty result', async () => {
    const u = await UserFactory.create({
      nuid: NUID,
      email: 'p@northeastern.edu',
    });
    await signIn('p@northeastern.edu');
    expect(await ProfSectionGroupsModel.count()).toBe(0);

    client.getSectionGroups.mockResolvedValue({
      semester: sem,
      section_groups: [{ id: 'sg_1', name: 'CS 1', crns: [11, 12] }],
    });
    await signIn('p@northeastern.edu');
    const row = await ProfSectionGroupsModel.findOneBy({ profId: u.id });
    expect(row.sectionGroups).toEqual([
      { id: 'sg_1', name: 'CS 1', crns: [11, 12], semester: sem },
    ]);
    await signIn('p@northeastern.edu');
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
      await signIn('p@northeastern.edu');
      expect(
        (await CourseModel.findOneBy({ id: course.id })).khourySectionGroupId,
      ).toBe('sg_1');
    });

    it('skips when another course already holds the id', async () => {
      await CourseFactory.create({ khourySectionGroupId: 'sg_1' });
      const course = await mapped();
      client.getSectionGroups.mockResolvedValue(groups('sg_1'));
      await signIn('p@northeastern.edu');
      expect(
        (await CourseModel.findOneBy({ id: course.id })).khourySectionGroupId,
      ).toBeNull();
    });

    describe('moved-group re-link', () => {
      const sg1 = 'sg_100000000000000001';
      const sg1b = 'sg_100000000000000002';
      const sg2 = 'sg_200000000000000001';
      const stamp = new Date('2026-01-01T00:00:00Z');
      const run = async (from: string | null, to: string) => {
        const course = await mapped({
          khourySectionGroupId: from,
          khouryRosterGeneratedAt: stamp,
        });
        client.getSectionGroups.mockResolvedValue(groups(to));
        await signIn('p@northeastern.edu');
        return CourseModel.findOneBy({ id: course.id });
      };

      it('sg_2 -> sg_1 re-links and clears the stamp', async () => {
        const c = await run(sg2, sg1);
        expect(c.khourySectionGroupId).toBe(sg1);
        expect(c.khouryRosterGeneratedAt).toBeNull();
      });

      it('does not re-link when the id changed to sg_2 after the read', async () => {
        const course = await mapped({ khouryRosterGeneratedAt: stamp });
        client.getSectionGroups.mockResolvedValue(groups(sg1));
        // Seam: the course is read (null id) inside courseCRNToCourse; a concurrent sign-in links it to sg_2 right after.
        const loginCourse = (service as any).loginCourse;
        const real = loginCourse.courseCRNToCourse.bind(loginCourse);
        jest
          .spyOn(loginCourse, 'courseCRNToCourse')
          .mockImplementation(async (...args: any[]) => {
            const c = await (real as any)(...args);
            if (c)
              await CourseModel.update(
                { id: course.id },
                { khourySectionGroupId: sg2 },
              );
            return c;
          });
        await signIn('p@northeastern.edu');
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining(`Course ${course.id}: group id changed`),
        );
        const c = await CourseModel.findOneBy({ id: course.id });
        expect(c.khourySectionGroupId).toBe(sg2);
        expect(c.khouryRosterGeneratedAt).toEqual(stamp);
        expect(client.getRoster).not.toHaveBeenCalled();
      });

      it('race: a sibling CRN does not take the sg_1 id when the first course moved to sg_2', async () => {
        const b = await mapped({ khouryRosterGeneratedAt: stamp });
        const a = await CourseFactory.create({
          semester: b.semester,
          khouryRosterGeneratedAt: stamp,
        });
        await CourseSectionMappingModel.create({
          crn: 11,
          courseId: a.id,
        }).save();
        client.getSectionGroups.mockResolvedValue(groups(sg1));
        const loginCourse = (service as any).loginCourse;
        const real = loginCourse.courseCRNToCourse.bind(loginCourse);
        jest
          .spyOn(loginCourse, 'courseCRNToCourse')
          .mockImplementation(async (...args: any[]) => {
            const c = await (real as any)(...args);
            if (c?.id === a.id)
              await CourseModel.update(
                { id: a.id },
                { khourySectionGroupId: sg2 },
              );
            return c;
          });
        await signIn('p@northeastern.edu');
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining(`Course ${a.id}: group id changed`),
        );
        const ca = await CourseModel.findOneBy({ id: a.id });
        const cb = await CourseModel.findOneBy({ id: b.id });
        expect(ca.khourySectionGroupId).toBe(sg2);
        expect(ca.khouryRosterGeneratedAt).toEqual(stamp);
        expect(cb.khourySectionGroupId).toBeNull();
        expect(cb.khouryRosterGeneratedAt).toEqual(stamp);
      });

      it('race: an sg_2 course (old id gone) whose id changes before the update is not re-linked', async () => {
        const course = await mapped({
          khourySectionGroupId: sg2,
          khouryRosterGeneratedAt: stamp,
        });
        client.getSectionGroups.mockResolvedValue(groups(sg1));
        const loginCourse = (service as any).loginCourse;
        const real = loginCourse.courseCRNToCourse.bind(loginCourse);
        jest
          .spyOn(loginCourse, 'courseCRNToCourse')
          .mockImplementation(async (...args: any[]) => {
            const c = await (real as any)(...args);
            if (c)
              await CourseModel.update(
                { id: course.id },
                { khourySectionGroupId: sg1b },
              );
            return c;
          });
        await signIn('p@northeastern.edu');
        expect(client.getRoster).toHaveBeenCalledWith(sg2);
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining(`Course ${course.id}: group id changed`),
        );
        const c = await CourseModel.findOneBy({ id: course.id });
        expect(c.khourySectionGroupId).toBe(sg1b);
        expect(c.khouryRosterGeneratedAt).toEqual(stamp);
      });

      it('sg_1 -> other sg_1 is unchanged', async () => {
        const c = await run(sg1, sg1b);
        expect(c.khourySectionGroupId).toBe(sg1);
        expect(c.khouryRosterGeneratedAt).toEqual(stamp);
      });

      it('sg_1 -> sg_2 is unchanged', async () => {
        const c = await run(sg1, sg2);
        expect(c.khourySectionGroupId).toBe(sg1);
        expect(c.khouryRosterGeneratedAt).toEqual(stamp);
      });

      it('sg_2 -> other sg_2 is unchanged', async () => {
        const c = await run(sg2, 'sg_200000000000000002');
        expect(c.khourySectionGroupId).toBe(sg2);
        expect(c.khouryRosterGeneratedAt).toEqual(stamp);
      });

      it('partial move: waits while A still lists the old sg_2 id', async () => {
        const course = await mapped({
          khourySectionGroupId: sg2,
          khouryRosterGeneratedAt: stamp,
        });
        await CourseSectionMappingModel.create({
          crn: 11,
          courseId: course.id,
        }).save();
        client.getSectionGroups.mockResolvedValue({
          semester: sem,
          section_groups: [
            { id: sg1, name: 'CS 1', crns: [11] },
            { id: sg2, name: 'CS 1 Boston', crns: [12] },
          ],
        });
        await signIn('p@northeastern.edu');
        expect(client.getRoster).not.toHaveBeenCalled();
        let c = await CourseModel.findOneBy({ id: course.id });
        expect(c.khourySectionGroupId).toBe(sg2);
        expect(c.khouryRosterGeneratedAt).toEqual(stamp);

        client.getSectionGroups.mockResolvedValue({
          semester: sem,
          section_groups: [{ id: sg1, name: 'CS 1', crns: [11, 12] }],
        });
        await signIn('p@northeastern.edu');
        expect(client.getRoster).toHaveBeenCalledWith(sg2);
        c = await CourseModel.findOneBy({ id: course.id });
        expect(c.khourySectionGroupId).toBe(sg1);
        expect(c.khouryRosterGeneratedAt).toBeNull();
      });

      it('partial move blocks a sibling from the sg_1 id, with no C call', async () => {
        const x = await mapped({ khourySectionGroupId: sg2 });
        const y = await CourseFactory.create({ semester: x.semester });
        await CourseSectionMappingModel.create({
          crn: 13,
          courseId: y.id,
        }).save();
        client.getSectionGroups.mockResolvedValue({
          semester: sem,
          section_groups: [
            { id: sg2, name: 'CS 1 Boston', crns: [14] },
            { id: sg1, name: 'CS 1', crns: [12, 13] },
          ],
        });
        await signIn('p@northeastern.edu');
        expect(client.getRoster).not.toHaveBeenCalled();
        expect(
          (await CourseModel.findOneBy({ id: x.id })).khourySectionGroupId,
        ).toBe(sg2);
        expect(
          (await CourseModel.findOneBy({ id: y.id })).khourySectionGroupId,
        ).toBeNull();
      });

      it('C returns a roster (co-taught): unchanged, C asked for the old id', async () => {
        client.getRoster.mockResolvedValue({ id: sg2 });
        const c = await run(sg2, sg1);
        expect(client.getRoster).toHaveBeenCalledWith(sg2);
        expect(c.khourySectionGroupId).toBe(sg2);
        expect(c.khouryRosterGeneratedAt).toEqual(stamp);
      });

      it('C returns null: re-linked, stamp cleared', async () => {
        const c = await run(sg2, sg1);
        expect(client.getRoster).toHaveBeenCalledWith(sg2);
        expect(c.khourySectionGroupId).toBe(sg1);
        expect(c.khouryRosterGeneratedAt).toBeNull();
      });

      it('C throws: unchanged, warns, A is still saved', async () => {
        client.getRoster.mockRejectedValue(new KhouryAdminError('down'));
        const c = await run(sg2, sg1);
        expect(c.khourySectionGroupId).toBe(sg2);
        expect(c.khouryRosterGeneratedAt).toEqual(stamp);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(sg2));
        expect(warn).not.toHaveBeenCalledWith(
          expect.stringContaining('A failed'),
        );
        expect(await ProfSectionGroupsModel.findOneBy({})).toBeTruthy();
      });

      it('C is called once per old id and warns once, across groups', async () => {
        client.getRoster.mockRejectedValue(new KhouryAdminError('down'));
        const course = await mapped({ khourySectionGroupId: sg2 });
        await CourseSectionMappingModel.create({
          crn: 11,
          courseId: course.id,
        }).save();
        await CourseSectionMappingModel.create({
          crn: 13,
          courseId: course.id,
        }).save();
        client.getSectionGroups.mockResolvedValue({
          semester: sem,
          section_groups: [
            { id: sg1, name: 'CS 1', crns: [11, 12] },
            { id: sg1b, name: 'CS 2', crns: [13] },
          ],
        });
        await signIn('p@northeastern.edu');
        expect(client.getRoster).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(1);
      });

      it.each([
        [[12, 13], 'roster'],
        [[13, 12], 'roster'],
        [[12, 13], 'error'],
        [[13, 12], 'error'],
      ])(
        'a held course does not let a sibling CRN take the sg_1 id (CRNs %j, C %s)',
        async (crns, c) => {
          if (c === 'roster') client.getRoster.mockResolvedValue({ id: sg2 });
          else client.getRoster.mockRejectedValue(new KhouryAdminError('down'));
          const held = await mapped({ khourySectionGroupId: sg2 });
          const sibling = await CourseFactory.create({
            semester: held.semester,
          });
          await CourseSectionMappingModel.create({
            crn: 13,
            courseId: sibling.id,
          }).save();
          client.getSectionGroups.mockResolvedValue({
            semester: sem,
            section_groups: [{ id: sg1, name: 'CS 1', crns }],
          });
          await signIn('p@northeastern.edu');
          expect(
            (await CourseModel.findOneBy({ id: held.id })).khourySectionGroupId,
          ).toBe(sg2);
          expect(
            (await CourseModel.findOneBy({ id: sibling.id }))
              .khourySectionGroupId,
          ).toBeNull();
        },
      );

      it('first link (null id) never calls C', async () => {
        await run(null, sg1);
        expect(client.getRoster).not.toHaveBeenCalled();
      });

      it('an sg_1 course never calls C', async () => {
        await run(sg1, sg1b);
        expect(client.getRoster).not.toHaveBeenCalled();
      });

      it('null id still links', async () => {
        const c = await run(null, sg1);
        expect(c.khourySectionGroupId).toBe(sg1);
        expect(c.khouryRosterGeneratedAt).toEqual(stamp);
      });

      it('new id held by another course leaves the course unchanged', async () => {
        await CourseFactory.create({ khourySectionGroupId: sg1 });
        const c = await run(sg2, sg1);
        expect(c.khourySectionGroupId).toBe(sg2);
        expect(c.khouryRosterGeneratedAt).toEqual(stamp);
      });
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
      const u = await signIn('s@northeastern.edu');
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
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
      });
      const uc = await UserCourseFactory.create({
        user: u,
        course,
        role: Role.STUDENT,
      });
      b('TA');
      await signIn('s@northeastern.edu');
      expect((await UserCourseModel.findOneBy({ id: uc.id })).role).toBe(
        Role.TA,
      );
      b('Student');
      await signIn('s@northeastern.edu');
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
      await signIn('s@northeastern.edu');
      expect(await UserCourseModel.count()).toBe(0);
    });
  });

  it('logs KhouryAdminError from A or B, leaves courses', async () => {
    const course = await CourseFactory.create({ khourySectionGroupId: 'sg_1' });
    const u = await UserFactory.create({
      nuid: NUID,
      email: 's@northeastern.edu',
    });
    const uc = await UserCourseFactory.create({
      user: u,
      course,
      role: Role.TA,
    });
    client.getSectionGroups.mockRejectedValue(new KhouryAdminError('down'));
    client.getCourses.mockRejectedValue(new KhouryAdminError('down'));
    await expect(service.onSignIn(u)).resolves.toBe(false);
    expect(await UserCourseModel.count()).toBe(1);
    expect((await UserCourseModel.findOneBy({ id: uc.id })).role).toBe(Role.TA);
  });

  it('keeps the A row and still applies B when A fails', async () => {
    const u = await UserFactory.create({
      nuid: NUID,
      email: 's@northeastern.edu',
    });
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
    await signIn('s@northeastern.edu');
    expect(
      (await ProfSectionGroupsModel.findOneBy({ profId: u.id })).sectionGroups,
    ).toEqual(rows);
    expect(
      (await UserCourseModel.findOneBy({ userId: u.id, courseId: course.id }))
        .role,
    ).toBe(Role.TA);
  });

  it('starts A and B together, before either resolves', async () => {
    await UserFactory.create({ nuid: NUID, email: 's@northeastern.edu' });
    let releaseA: () => void;
    client.getSectionGroups.mockReturnValue(
      new Promise((r) => {
        releaseA = () => r({ semester: sem, section_groups: [] });
      }),
    );
    const done = signIn('s@northeastern.edu');
    await new Promise((r) => setTimeout(r, 50));
    expect(client.getSectionGroups).toHaveBeenCalledTimes(1);
    expect(client.getCourses).toHaveBeenCalledTimes(1);
    releaseA();
    await done;
  });

  it('keeps A saved and does not throw when B fails', async () => {
    const u = await UserFactory.create({
      nuid: NUID,
      email: 's@northeastern.edu',
    });
    client.getSectionGroups.mockResolvedValue({
      semester: sem,
      section_groups: [{ id: 'sg_1', name: 'N', crns: [1] }],
    });
    client.getCourses.mockRejectedValue(new KhouryAdminError('down'));
    await signIn('s@northeastern.edu');
    expect(
      (await ProfSectionGroupsModel.findOneBy({ profId: u.id })).sectionGroups,
    ).toHaveLength(1);
  });

  it('a KhouryAdminError rejection from A is logged and B is still applied', async () => {
    const u = await UserFactory.create({
      nuid: NUID,
      email: 's@northeastern.edu',
    });
    const course = await CourseFactory.create({ khourySectionGroupId: 'sg_1' });
    client.getSectionGroups.mockImplementation(async () => {
      throw new KhouryAdminError('bad');
    });
    client.getCourses.mockResolvedValue({
      semester: sem,
      courses: [{ section_group_id: 'sg_1', role: 'TA' }],
    });
    await signIn('s@northeastern.edu');
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
    await expect(signIn('p@northeastern.edu')).resolves.toBeDefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`Course ${y.id}\\b.*sg_120271000000000001`),
      ),
    );
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
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
      });
      const uc = await UserCourseFactory.create({ user: u, course, ...row });
      client.getCourses.mockResolvedValue({
        semester: sem,
        courses: [{ section_group_id: 'sg_1', role: bRole }],
      });
      await signIn('s@northeastern.edu');
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
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
      });
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
      await signIn('s@northeastern.edu');
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
      await signIn('s@northeastern.edu');
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
      await signIn('p@northeastern.edu');
      expect(
        (await CourseModel.findOneBy({ id: y.id })).khourySectionGroupId,
      ).toBe('sg_1');
      expect(
        (await CourseModel.findOneBy({ id: x.id })).khourySectionGroupId,
      ).toBe('sg_other');
    });

    it('concurrent sign-ins of a professor leave one row with A groups', async () => {
      client.getSectionGroups.mockResolvedValue({
        semester: sem,
        section_groups: [{ id: 'sg_1', name: 'CS', crns: [1] }],
      });
      const u = await UserFactory.create({
        nuid: NUID,
        email: 'p@northeastern.edu',
      });
      await Promise.all([service.onSignIn(u), service.onSignIn(u)]);
      const rows = await ProfSectionGroupsModel.find();
      expect(rows).toHaveLength(1);
      expect(rows[0].sectionGroups).toEqual([
        { id: 'sg_1', name: 'CS', crns: [1], semester: sem },
      ]);
    });

    it('DB rejects a second legacy user with the same email', async () => {
      await UserFactory.create({ nuid: NUID, email: 'dup@northeastern.edu' });
      await expect(
        UserFactory.create({ nuid: NUID, email: 'dup@northeastern.edu' }),
      ).rejects.toMatchObject({ driverError: { code: '23505' } });
    });

    it('concurrent sign-ins create one membership', async () => {
      await UserFactory.create({ nuid: NUID, email: 's@northeastern.edu' });
      await CourseFactory.create({ khourySectionGroupId: 'sg_1' });
      client.getCourses.mockResolvedValue({
        semester: sem,
        courses: [{ section_group_id: 'sg_1', role: 'Student' }],
      });
      await Promise.all([
        signIn('s@northeastern.edu'),
        signIn('s@northeastern.edu'),
      ]);
      expect(await UserCourseModel.count()).toBe(1);
    });
  });

  describe('syncIfDue', () => {
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
    const synced = async (u: UserModel) =>
      (await UserModel.findOneByOrFail({ id: u.id })).lastKhourySyncAt;

    it('syncs a never-synced user and records the time', async () => {
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
      });
      await service.syncIfDue(u);
      expect(client.getSectionGroups).toHaveBeenCalledTimes(1);
      expect(client.getCourses).toHaveBeenCalledTimes(1);
      expect(await synced(u)).not.toBeNull();
    });

    it('does nothing when synced 1 hour ago', async () => {
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
        lastKhourySyncAt: hoursAgo(1),
      });
      await service.syncIfDue(u);
      expect(client.getSectionGroups).not.toHaveBeenCalled();
      expect(client.getCourses).not.toHaveBeenCalled();
    });

    it('syncs when synced 25 hours ago', async () => {
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
        lastKhourySyncAt: hoursAgo(25),
      });
      await service.syncIfDue(u);
      expect(client.getSectionGroups).toHaveBeenCalledTimes(1);
      expect(Date.now() - (await synced(u)).getTime()).toBeLessThan(60_000);
    });

    it('two concurrent calls run one sync', async () => {
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
      });
      await Promise.all([service.syncIfDue(u), service.syncIfDue(u)]);
      expect(client.getSectionGroups).toHaveBeenCalledTimes(1);
    });

    it('B runs with the NUID; a null NUID skips B and A still runs', async () => {
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
      });
      await service.syncIfDue(u);
      expect(client.getCourses).toHaveBeenCalledWith(
        's@northeastern.edu',
        sem,
        NUID,
      );
      client.getCourses.mockClear();
      const v = await UserFactory.create({
        nuid: null,
        email: 't@northeastern.edu',
      });
      await service.syncIfDue(v);
      expect(client.getCourses).not.toHaveBeenCalled();
      expect(client.getSectionGroups).toHaveBeenLastCalledWith(
        't@northeastern.edu',
        sem,
      );
      expect(warn).toHaveBeenCalledWith(
        `Skipping Khoury Admin B: user ${v.id} has no NUID`,
      );
      // NOTE: a skipped B is not a failure, so the stamp keeps the full 24h
      expect(Date.now() - (await synced(v)).getTime()).toBeLessThan(60_000);
    });

    it('a recent in-memory stamp returns early without touching the DB', async () => {
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
        lastKhourySyncAt: hoursAgo(1),
      });
      const spy = jest.spyOn(UserModel, 'createQueryBuilder');
      try {
        await service.syncIfDue(u);
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
      expect(client.getSectionGroups).not.toHaveBeenCalled();
    });

    it('a spaces-only NUID skips B; a padded NUID is sent trimmed', async () => {
      const blank = await UserFactory.create({
        nuid: '   ',
        email: 'b@northeastern.edu',
      });
      await service.syncIfDue(blank);
      expect(client.getSectionGroups).toHaveBeenCalledTimes(1);
      expect(client.getCourses).not.toHaveBeenCalled();
      const padded = await UserFactory.create({
        nuid: ` ${NUID} `,
        email: 'p@northeastern.edu',
      });
      await service.syncIfDue(padded);
      expect(client.getCourses).toHaveBeenCalledWith(
        'p@northeastern.edu',
        sem,
        NUID,
      );
    });

    it('an unexpected error saving A does not stop B, and is rethrown', async () => {
      const course = await CourseFactory.create({
        khourySectionGroupId: 'sg_1',
      });
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
      });
      client.getSectionGroups.mockResolvedValue({
        semester: sem,
        section_groups: [{ id: 'sg_9', name: 'N', crns: [1] }],
      });
      client.getCourses.mockResolvedValue({
        semester: sem,
        courses: [{ section_group_id: 'sg_1', role: 'TA' }],
      });
      const spy = jest
        .spyOn(ProfSectionGroupsModel, 'upsert')
        .mockRejectedValue(new Error('db down'));
      try {
        await expect(service.syncIfDue(u)).rejects.toMatchObject({
          message: 'Khoury Admin A failed',
          cause: { message: 'db down' },
        });
      } finally {
        spy.mockRestore();
      }
      expect(
        (await UserCourseModel.findOneBy({ userId: u.id, courseId: course.id }))
          .role,
      ).toBe(Role.TA);
    });

    it('a falsy rejection from A still makes syncIfDue reject', async () => {
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
      });
      client.getSectionGroups.mockRejectedValue(undefined);
      await expect(service.syncIfDue(u)).rejects.toMatchObject({
        message: 'Khoury Admin A failed',
      });
      // NOTE: a thrown sync also releases the claim
      expect(Date.now() - (await synced(u)).getTime()).toBeGreaterThan(
        23 * 3600_000,
      );
    });

    it('an unexpected B failure keeps the saved A row and rethrows', async () => {
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
      });
      client.getSectionGroups.mockResolvedValue({
        semester: sem,
        section_groups: [{ id: 'sg_1', name: 'N', crns: [1] }],
      });
      const boom = new Error('b boom');
      client.getCourses.mockRejectedValue(boom);
      await expect(service.syncIfDue(u)).rejects.toMatchObject({
        message: 'Khoury Admin B failed',
        cause: boom,
      });
      expect(
        (await ProfSectionGroupsModel.findOneBy({ profId: u.id }))
          .sectionGroups,
      ).toHaveLength(1);
    });

    it('a blank email skips both A and B with a warning', async () => {
      const u = await UserFactory.create({ nuid: NUID, email: '  ' });
      await service.syncIfDue(u);
      expect(client.getSectionGroups).not.toHaveBeenCalled();
      expect(client.getCourses).not.toHaveBeenCalled(); // no email to ask with
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('no email'));
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('no NUID'));
    });

    it('logging: unexpected errors are not logged by the service; a KhouryAdminError warns once', async () => {
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
      });
      client.getSectionGroups.mockRejectedValue(undefined);
      client.getCourses.mockRejectedValue(new Error('b boom'));
      const err = await service.onSignIn(u).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect(err.errors.map((x) => x.message)).toEqual([
        'Khoury Admin A failed',
        'Khoury Admin B failed',
      ]);
      expect(err.errors[0].cause).toBeUndefined();
      expect(err.errors[1].cause.message).toBe('b boom');
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();

      client.getSectionGroups.mockResolvedValue({
        semester: sem,
        section_groups: [],
      });
      client.getCourses.mockRejectedValue(new KhouryAdminError('down'));
      await expect(service.onSignIn(u)).resolves.toBe(false);
      expect(error).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('a throwing claim UPDATE rejects syncIfDue and calls no client', async () => {
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
      });
      const spy = jest
        .spyOn(UserModel, 'createQueryBuilder')
        .mockImplementation(() => {
          throw new Error('db down');
        });
      try {
        await expect(service.syncIfDue(u)).rejects.toThrow('db down');
      } finally {
        spy.mockRestore();
      }
      expect(client.getSectionGroups).not.toHaveBeenCalled();
    });

    it('client failure keeps memberships, resolves, and keeps the timestamp', async () => {
      const course = await CourseFactory.create({
        khourySectionGroupId: 'sg_1',
      });
      const u = await UserFactory.create({
        nuid: NUID,
        email: 's@northeastern.edu',
      });
      await UserCourseFactory.create({ user: u, course, role: Role.TA });
      client.getSectionGroups.mockRejectedValue(new KhouryAdminError('down'));
      client.getCourses.mockRejectedValue(new KhouryAdminError('down'));
      await expect(service.syncIfDue(u)).resolves.toBeUndefined();
      expect(await UserCourseModel.count()).toBe(1);
      expect(await synced(u)).not.toBeNull();
    });

    describe('retry after a failed sync', () => {
      const MIN = 60_000;
      const reload = (u: UserModel) => UserModel.findOneByOrFail({ id: u.id });
      // NOTE: simulates time passing by moving the stored stamp back
      const age = async (u: UserModel, minutes: number) =>
        UserModel.update(u.id, {
          lastKhourySyncAt: new Date(
            (await synced(u)).getTime() - minutes * MIN,
          ),
        });
      let u: UserModel;
      beforeEach(async () => {
        u = await UserFactory.create({
          nuid: NUID,
          email: 's@northeastern.edu',
        });
      });

      it('a partial failure (A ok, B rejected) is due again after 15 minutes, not 24h', async () => {
        client.getCourses.mockRejectedValue(new KhouryAdminError('down'));
        await expect(service.syncIfDue(u)).resolves.toBeUndefined();
        const due = (await synced(u)).getTime() + 24 * 3600_000;
        expect(Math.abs(due - (Date.now() + 15 * MIN))).toBeLessThan(MIN);
        expect(u.lastKhourySyncAt).toEqual(await synced(u)); // in-memory stamp follows

        client.getSectionGroups.mockClear();
        await service.syncIfDue(await reload(u));
        expect(client.getSectionGroups).not.toHaveBeenCalled(); // not yet due

        await age(u, 16);
        await service.syncIfDue(await reload(u));
        expect(client.getSectionGroups).toHaveBeenCalledTimes(1);
      });

      it('A rejected with a KhouryAdminError, B ok: due again in 15 minutes', async () => {
        client.getSectionGroups.mockRejectedValue(new KhouryAdminError('down'));
        await expect(service.syncIfDue(u)).resolves.toBeUndefined();
        expect(client.getCourses).toHaveBeenCalledTimes(1);
        const due = (await synced(u)).getTime() + 24 * 3600_000;
        expect(Math.abs(due - (Date.now() + 15 * MIN))).toBeLessThan(MIN);
      });

      it('a successful sync keeps the full 24h', async () => {
        await service.syncIfDue(u);
        expect(Date.now() - (await synced(u)).getTime()).toBeLessThan(MIN);
        await age(u, 16);
        client.getSectionGroups.mockClear();
        await service.syncIfDue(await reload(u));
        expect(client.getSectionGroups).not.toHaveBeenCalled();
      });

      it('the rollback does not clobber a newer stamp', async () => {
        const newer = new Date(Date.now() + 5 * MIN);
        client.getSectionGroups.mockImplementation(async () => {
          await UserModel.update(u.id, { lastKhourySyncAt: newer });
          throw new KhouryAdminError('down');
        });
        await service.syncIfDue(u);
        expect(await synced(u)).toEqual(newer);
      });

      it('a failing rollback is logged and does not replace the sync result', async () => {
        const real = UserModel.createQueryBuilder.bind(UserModel);
        const spy = jest
          .spyOn(UserModel, 'createQueryBuilder')
          .mockImplementationOnce(real)
          .mockImplementationOnce(() => {
            throw new Error('release boom');
          });
        client.getSectionGroups.mockRejectedValue(new KhouryAdminError('down'));
        try {
          await expect(service.syncIfDue(u)).resolves.toBeUndefined();
        } finally {
          spy.mockRestore();
        }
        expect(error).toHaveBeenCalledWith(
          expect.stringContaining('claim release failed'),
        );
        expect(error.mock.calls[0][0]).toContain('release boom');
      });
    });
  });
});
