import { Season } from '@koh/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  CourseFactory,
  CourseSectionFactory,
  SemesterFactory,
} from '../../test/util/factories';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { CourseModel } from '../course/course.entity';
import { SemesterModel } from '../semester/semester.entity';
import { LoginCourseService } from './login-course.service';

// Resolving a CRN in a new semester creates that semester; it must never
// disable existing courses (a past incident took in-session courses offline).
describe('LoginCourseService semester transitions', () => {
  let service: LoginCourseService;
  let conn: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule],
      providers: [LoginCourseService],
    }).compile();
    service = module.get(LoginCourseService);
    conn = module.get(DataSource);
  });
  afterAll(() => conn.destroy());
  beforeEach(() => conn.synchronize(true));

  const find = (season: Season, year: number) =>
    SemesterModel.findOne({ where: { season, year } });

  const expectEnabled = async (courses: CourseModel[]) => {
    for (const c of courses) {
      await c.reload();
      expect(c.enabled).toBe(true);
    }
  };

  it('cycles between semesters', async () => {
    const fall2020 = await SemesterFactory.create({
      season: 'Fall',
      year: 2020,
    });
    const summerFull = await SemesterFactory.create({
      season: 'Summer_Full',
      year: 2022,
    });
    const summer2 = await SemesterFactory.create({
      season: 'Summer_2',
      year: 2022,
    });
    const old = await CourseFactory.createList(2, { semester: fall2020 });
    const course4 = await CourseFactory.create({ semester: summerFull });
    const course5 = await CourseFactory.create({ semester: summer2 });
    expect(await find('Fall', 2022)).toBeNull();

    // no mapping exists in the new semester yet
    expect(await service.courseCRNToCourse(12345, '202310')).toBeUndefined();

    expect(await find('Fall', 2022)).not.toBeNull();
    await expectEnabled([...old, course4, course5]);
  });

  it('does not change course enabled state across semester changes', async () => {
    const fall2020 = await SemesterFactory.create({
      season: 'Fall',
      year: 2020,
    });
    const summer1 = await SemesterFactory.create({
      season: 'Summer_1',
      year: 2022,
    });
    const old = await CourseFactory.createList(2, { semester: fall2020 });
    const course4 = await CourseFactory.create({ semester: summer1 });

    await service.courseCRNToCourse(23456, '202250'); // Summer Full 2022
    await expectEnabled([...old, course4]);

    const summerFull = await find('Summer_Full', 2022);
    expect(summerFull).not.toBeNull();
    const course5 = await CourseFactory.create({ semester: summerFull });
    await CourseSectionFactory.create({ crn: 23456, course: course5 });

    await service.courseCRNToCourse(23456, '202260'); // Summer 2 2022
    expect(await find('Summer_2', 2022)).not.toBeNull();
    await expectEnabled([...old, course4, course5]);

    // cycling back reuses the existing semester row and resolves the mapping
    const found = await service.courseCRNToCourse(23456, '202250');
    expect(found.id).toBe(course5.id);
    expect((await find('Summer_Full', 2022)).id).toBe(summerFull.id);
    expect(
      await SemesterModel.count({
        where: { season: 'Summer_Full', year: 2022 },
      }),
    ).toBe(1);
    await expectEnabled([...old, course4, course5]);
  });
});
