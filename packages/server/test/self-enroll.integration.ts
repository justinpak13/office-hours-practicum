import { LoginModule } from '../src/login/login.module';
import { CourseFactory } from './util/factories';
import { setupIntegrationTest } from './util/testUtils';

describe('Self-enroll Integration', () => {
  const supertest = setupIntegrationTest(LoginModule);

  describe('GET /self_enroll_courses', () => {
    it('returns only self-enroll courses, as id and name only', async () => {
      const course = await CourseFactory.create({
        selfEnroll: true,
        khourySectionGroupId: 'sg-1',
        khouryRosterGeneratedAt: new Date(),
        icalURL: 'https://example.com/cal.ics',
      });
      await CourseFactory.create({ selfEnroll: false });

      const res = await supertest().get('/self_enroll_courses').expect(200);

      expect(res.body.courses).toStrictEqual([
        { id: course.id, name: course.name },
      ]);
    });

    // Regression test: this used find({ take: 1 })[0], which is always
    // undefined, so the route crashed with a 500 instead of filtering
    it('returns every course with self-enroll on, and none with it off', async () => {
      const enrolledA = await CourseFactory.create({
        name: 'CS 2500',
        selfEnroll: true,
      });
      const enrolledB = await CourseFactory.create({
        name: 'CS 3500',
        selfEnroll: true,
      });
      await CourseFactory.create({ name: 'CS 4500', selfEnroll: false });

      const res = await supertest().get('/self_enroll_courses').expect(200);

      const ids = res.body.courses.map((c) => c.id).sort((a, b) => a - b);
      expect(ids).toEqual([enrolledA.id, enrolledB.id].sort((a, b) => a - b));
    });

    it('returns an empty list when no course has self-enroll on', async () => {
      await CourseFactory.create({ selfEnroll: false });

      const res = await supertest().get('/self_enroll_courses').expect(200);

      expect(res.body.courses).toEqual([]);
    });
  });
});
