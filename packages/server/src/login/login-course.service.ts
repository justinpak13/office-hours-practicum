import {
  isKhouryCourse,
  KhouryDataParams,
  KhouryProfCourse,
  Role,
  Season,
} from '@koh/common';
import { Injectable, Logger } from '@nestjs/common';
import { CourseModel } from 'course/course.entity';
import { CourseSectionMappingModel } from 'login/course-section-mapping.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { UserModel } from 'profile/user.entity';
import { SemesterModel } from 'semester/semester.entity';
import { Connection } from 'typeorm';
import { ProfSectionGroupsModel } from './prof-section-groups.entity';
import { khourySemesterCodes } from './last-registration-model.entity';
import {
  fetchPhoto,
  isCustomPhoto,
  khouryPhotoFileName,
  savePhotoBuffer,
} from 'profile/photos';

@Injectable()
export class LoginCourseService {
  private readonly logger = new Logger(LoginCourseService.name);

  constructor(private connection: Connection) {}

  public async addUserFromKhoury(info: KhouryDataParams): Promise<UserModel> {
    let user: UserModel;
    const neuEmail = info.email.replace('@husky.neu.edu', '@northeastern.edu');
    user = await UserModel.findOne({
      where: { email: neuEmail },
      relations: ['courses', 'courses.course'],
    });

    if (!user) {
      user = await UserModel.create({
        courses: [],
        email: neuEmail,
        firstName: info.first_name,
        lastName: info.last_name,
        hideInsights: [],
      }).save();
    }

    const userCourses = [];

    for (const c of info.courses) {
      if (isKhouryCourse(c)) {
        const course = await this.courseCRNToCourse(c.crn, c.semester);

        if (course) {
          const userCourse = await this.courseToUserCourse(
            user.id,
            course.id,
            this.convertKhouryRole(c.role),
          );
          userCourses.push(userCourse);
        }
      } else {
        // c is a KhouryProfCourse
        // only need to inspect one of the CRNs from the list
        // b/c they should all map to the same section group
        if (c.crns.length !== 0) {
          const courseCRN = c.crns[0];
          const profCourse = await this.courseCRNToCourse(
            courseCRN,
            c.semester,
          );

          if (profCourse) {
            const profUserCourse = await this.courseToUserCourse(
              user.id,
              profCourse.id,
              Role.PROFESSOR,
            );
            userCourses.push(profUserCourse);
          }
        }
      }
    }

    // Delete "stale" user courses
    for (const previousCourse of user.courses) {
      if (
        !this.hasUserCourse(userCourses, previousCourse) &&
        previousCourse.course.enabled
      ) {
        if (!previousCourse.override) {
          previousCourse.remove();
        } else {
          userCourses.push(previousCourse);
        }
      }
    }

    // If Prof, save the JSON data
    if (info.courses[0] && !isKhouryCourse(info.courses[0])) {
      const profSectionGroups = await ProfSectionGroupsModel.findOne({
        where: { profId: user.id },
      });
      if (profSectionGroups) {
        profSectionGroups.sectionGroups = info.courses as KhouryProfCourse[];
        await profSectionGroups.save();
      } else {
        await ProfSectionGroupsModel.create({
          profId: user.id,
          sectionGroups: info.courses,
        }).save();
      }
    }

    user.courses = userCourses;
    await user.save();
    return user;
  }

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

  public async courseToUserCourse(
    userId: number,
    courseId: number,
    role: Role,
  ): Promise<UserCourseModel> {
    let userCourse: UserCourseModel;
    userCourse = await UserCourseModel.findOne({
      where: { userId, courseId },
    });
    if (userCourse && userCourse.override && userCourse.role === role) {
      userCourse.override = false;
      await userCourse.save();
    }
    if (!userCourse) {
      userCourse = await UserCourseModel.create({
        userId,
        courseId,
        role,
      }).save();
    }
    return userCourse;
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
      this.logger.log(`New semester created: ${season} ${year} (id=${semModel.id})`);
    }
    return semModel;
  }

  private hasUserCourse(
    userCourses: UserCourseModel[],
    previousCourse: UserCourseModel,
  ): boolean {
    return userCourses.some(
      (uc) =>
        uc.courseId === previousCourse.courseId &&
        uc.userId === previousCourse.userId &&
        uc.role === previousCourse.role,
    );
  }

  // util functions for converting Khoury Admin data to KOH data
  private convertKhouryRole(khouryRole: 'TA' | 'Student'): Role {
    return khouryRole.toLowerCase() === 'ta' ? Role.TA : Role.STUDENT;
  }

  /**
   * Download the (expiring) Khoury photo-service URL into local storage,
   * unless the user has uploaded their own picture (custom photos win).
   * Called fire-and-forget from the login flow - must never block a login.
   */
  public async syncKhouryPhoto(
    userId: number,
    photoUrl: string,
  ): Promise<void> {
    if (!photoUrl) {
      return;
    }
    const user = await UserModel.findOne(userId);
    if (!user || (user.photoURL && isCustomPhoto(user.photoURL))) {
      return;
    }
    const buffer = await fetchPhoto(photoUrl);
    const fileName = khouryPhotoFileName(userId);
    // Throws (aborting the sync) if the response was not a decodable image
    await savePhotoBuffer(buffer, fileName);
    if (user.photoURL !== fileName) {
      user.photoURL = fileName;
      await user.save();
    }
  }
}
