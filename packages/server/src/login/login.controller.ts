import {
  ERROR_MESSAGES,
  GetSelfEnrollResponse,
  KhouryDataParams,
  KhouryRedirectResponse,
  Role,
} from '@koh/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as Sentry from '@sentry/node';
import { CourseModel } from 'course/course.entity';
import { User } from 'decorators/user.decorator';
import { Request, Response } from 'express';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { createHmac, timingSafeEqual } from 'crypto';
import { UserCourseModel } from 'profile/user-course.entity';
import { UserModel } from 'profile/user.entity';
import { Connection } from 'typeorm';
import { NonProductionGuard } from '../guards/non-production.guard';
import { LoginCourseService } from './login-course.service';

@Controller()
export class LoginController {
  constructor(
    private connection: Connection,
    private loginCourseService: LoginCourseService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  @Post('/khoury_login')
  async recieveDataFromKhoury(
    @Req() req: Request,
    @Body() body: KhouryDataParams,
  ): Promise<KhouryRedirectResponse> {
    if (process.env.NODE_ENV === 'production') {
      // Check that request has come from Khoury:
      // X-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>." + raw body>
      const header = req.headers['x-signature'];
      const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(
        typeof header === 'string' ? header : '',
      );
      if (!match || !(req as any).rawBody) {
        Sentry.captureMessage('Missing or malformed request signature');
        throw new UnauthorizedException('Invalid request signature');
      }
      const [, timestamp, signature] = match;
      if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
        Sentry.captureMessage('Expired request signature');
        throw new UnauthorizedException('Invalid request signature');
      }
      const expected = createHmac(
        'sha256',
        this.configService.get('KHOURY_HMAC_KEY'),
      )
        .update(`${timestamp}.`)
        .update((req as any).rawBody)
        .digest('hex');
      if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
        Sentry.captureMessage('Invalid request signature');
        throw new UnauthorizedException('Invalid request signature');
      }
    }

    let user;
    try {
      user = await this.loginCourseService.addUserFromKhoury(body);
    } catch (e) {
      Sentry.captureException(e);
      console.error('Khoury login threw an exception for', body.email);
      console.error(e);
      throw new HttpException(
        ERROR_MESSAGES.loginController.addUserFromKhoury,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    // Sync the user photo in the background; never blocks or fails the login
    this.loginCourseService
      .syncKhouryPhoto(user.id, body.photo_url)
      .catch((err) =>
        console.error('Failed to sync Khoury photo for user', user.id, err),
      );

    // Create temporary login token to send user to.
    const token = await this.jwtService.signAsync(
      { userId: user.id, token_type: 'login' },
      { expiresIn: 60 },
    );

    if (token === null || token === undefined) {
      console.error('Temporary JWT is invalid');
      throw new HttpException(
        ERROR_MESSAGES.loginController.invalidTempJWTToken,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      redirect:
        this.configService.get('DOMAIN') + `/api/v1/login/entry?token=${token}`,
    };
  }

  // NOTE: Although the two routes below are on the backend,
  // they are meant to be visited by the browser so a cookie can be set

  // This is the real admin entry point
  @Get('/login/entry')
  async enterFromKhoury(
    @Res() res: Response,
    @Query('token') token: string,
  ): Promise<void> {
    let payload: { userId: number; token_type?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch (err) {
      throw new UnauthorizedException();
    }

    // Only short-lived login tokens may enter; auth tokens are rejected
    if (!payload || payload.token_type !== 'login') {
      throw new UnauthorizedException();
    }

    return this.enter(res, payload.userId);
  }

  // This is for login on development only
  @Get('/login/dev')
  @UseGuards(NonProductionGuard)
  async enterFromDev(
    @Res() res: Response,
    @Query('userId') userId: number,
  ): Promise<void> {
    this.enter(res, userId);
  }

  // Set cookie and redirect to proper page
  private async enter(res: Response, userId: number) {
    const authToken = await this.jwtService.signAsync(
      { userId, token_type: 'auth' },
      // Expires in 30 days
      { expiresIn: 60 * 60 * 24 * 30 },
    );

    if (authToken === null || authToken === undefined) {
      console.error('Authroziation JWT is invalid');
      throw new HttpException(
        ERROR_MESSAGES.loginController.invalidTempJWTToken,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const isSecure = this.configService
      .get<string>('DOMAIN')
      .startsWith('https://');
    res
      .cookie('auth_token', authToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
      })
      .redirect(302, '/');
  }

  @Post('/logout')
  async logout(@Res() res: Response): Promise<void> {
    const isSecure = this.configService
      .get<string>('DOMAIN')
      .startsWith('https://');
    res
      .clearCookie('auth_token', {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
      })
      .status(200)
      .send();
  }

  @Get('self_enroll_courses')
  async selfEnrollEnabledAnywhere(): Promise<GetSelfEnrollResponse> {
    const courses = await CourseModel.find();
    return { courses: courses.filter((course) => course.selfEnroll) };
  }

  @Post('create_self_enroll_override/:id')
  @UseGuards(JwtAuthGuard)
  async createSelfEnrollOverride(
    @Param('id') courseId: number,
    @User() user: UserModel,
  ): Promise<void> {
    const course = await CourseModel.findOne(courseId);

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
