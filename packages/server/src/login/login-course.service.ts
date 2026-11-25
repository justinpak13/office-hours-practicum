import { Season } from '@koh/common';
import { Injectable, ConsoleLogger } from '@nestjs/common';
import { CourseModel } from 'course/course.entity';
import { CourseSectionMappingModel } from 'login/course-section-mapping.entity';
import { SemesterModel } from 'semester/semester.entity';
import { DataSource } from 'typeorm';
import { khourySemesterCodes } from './last-registration-model.entity';

@Injectable()
export class LoginCourseService {
  private readonly logger = new ConsoleLogger(LoginCourseService.name);

  constructor(private connection: DataSource) {}

  public async courseCRNToCourse(
    courseCRN: number,
    semester: string, // 6-digit semester code
  ): Promise<CourseModel> {
    const semModel = await this.getOrTransitionSemester(semester);
    const courseSectionModel =
      await CourseSectionMappingModel.createQueryBuilder('section_mapping')
        .leftJoinAndSelect('section_mapping.course', 'course')
        .where(
          'section_mapping.crn = :courseCRN and course.semesterId = :semesterId',
          { courseCRN, semesterId: semModel.id },
        )
        .getOne();

    return courseSectionModel?.course;
  }

  // parses 6-digit semester code, where first 4 digits represent year and last 2 digits represent academic semester (ex: 202110)
  public parseKhourySemester(khourySemester: string): {
    season: Season;
    year: number;
  } {
    // parsing time
    let year = Number(khourySemester.slice(0, 4));
    const semesterCode = khourySemester.slice(-2);
    const season = Object.keys(khourySemesterCodes).find(
      (key) => khourySemesterCodes[key] === semesterCode,
    ) as Season;
    // edge case for Fall semester, included in the next academic year
    if (season === 'Fall') {
      year--;
    }

    return { season, year };
  }

  // Return SemesterModel for the given khoury semester string, creating it if it
  // does not already exist in the database. Courses from past semesters are NOT
  // disabled automatically: registration data for an upcoming semester arrives while
  // the current one is still in session, so disabling on semester creation took
  // in-session courses offline (2026-07-28). Old courses are disabled via the admin
  // panel instead.
  private async getOrTransitionSemester(khourySemester: string) {
    const { season, year } = this.parseKhourySemester(khourySemester);
    let semModel = await SemesterModel.findOne({ where: { season, year } });
    if (!semModel) {
      semModel = await SemesterModel.create({
        season,
        year,
        courses: [],
      }).save();
      this.logger.log(
        `New semester created: ${season} ${year} (id=${semModel.id})`,
      );
    }
    return semModel;
  }
}
