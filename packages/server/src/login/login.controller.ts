import { GetSelfEnrollResponse, Role } from '@koh/common';
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CourseModel } from 'course/course.entity';
import { User } from 'decorators/user.decorator';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { UserCourseModel } from 'profile/user-course.entity';
import { UserModel } from 'profile/user.entity';

// Logging in and out is handled by oauth2-proxy (/oauth2/start and
// /oauth2/sign_out); see JwtStrategy for how requests are authenticated.
@Controller()
export class LoginController {
  @Get('self_enroll_courses')
  async selfEnrollEnabledAnywhere(): Promise<GetSelfEnrollResponse> {
    const courses = await CourseModel.find({ where: { selfEnroll: true } });
    // NOTE: public route, so return only the CoursePartial shape
    return { courses: courses.map(({ id, name }) => ({ id, name })) };
  }

  @Post('create_self_enroll_override/:id')
  @UseGuards(JwtAuthGuard)
  async createSelfEnrollOverride(
    @Param('id') courseId: number,
    @User() user: UserModel,
  ): Promise<void> {
    const course = await CourseModel.findOne({ where: { id: courseId } });

    if (!course || !course.selfEnroll) {
      throw new UnauthorizedException(
        'Cannot self-enroll to this course currently',
      );
    }

    const prevUCM = await UserCourseModel.findOne({
      where: {
        courseId,
        userId: user.id,
      },
    });

    if (prevUCM) {
      throw new BadRequestException(
        'User already has an override for this course',
      );
    }

    await UserCourseModel.create({
      userId: user.id,
      courseId: courseId,
      role: Role.STUDENT,
      override: true,
      expires: true,
    }).save();
  }
}
