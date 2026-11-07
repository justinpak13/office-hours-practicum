import {
  DesktopNotifPartial,
  ERROR_MESSAGES,
  GetProfileResponse,
  UpdateProfileParams,
} from '@koh/common';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as checkDiskSpace from 'check-disk-space';
import { Response } from 'express';
import * as fs from 'fs';
import { pick } from 'lodash';
import { memoryStorage } from 'multer';
import * as path from 'path';
import { Connection } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NotificationService } from '../notification/notification.service';
import { User } from '../decorators/user.decorator';
import { UserModel } from './user.entity';
import { ProfileService } from './profile.service';
import {
  customPhotoFileName,
  deletePhotoFile,
  isCustomPhoto,
  isSafePhotoFileName,
  savePhotoBuffer,
  uploadDir,
} from './photos';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private connection: Connection,
    private notifService: NotificationService,
    private profileService: ProfileService,
  ) {}

  @Get()
  async get(
    @User(['courses', 'courses.course', 'phoneNotif', 'desktopNotifs'])
    user: UserModel,
  ): Promise<GetProfileResponse> {
    if (user === null || user === undefined) {
      console.error(ERROR_MESSAGES.profileController.accountNotAvailable);
      throw new HttpException(
        ERROR_MESSAGES.profileController.accountNotAvailable,
        HttpStatus.NOT_FOUND,
      );
    }

    const courses = user.courses
      .filter((userCourse) => userCourse.course.enabled)
      .map((userCourse) => {
        return {
          course: {
            id: userCourse.courseId,
            name: userCourse.course.name,
          },
          role: userCourse.role,
        };
      });

    const desktopNotifs: DesktopNotifPartial[] = user.desktopNotifs.map(
      (d) => ({
        endpoint: d.endpoint,
        id: d.id,
        createdAt: d.createdAt,
        name: d.name,
      }),
    );

    const userResponse = pick(user, [
      'id',
      'email',
      'name',
      'firstName',
      'lastName',
      'photoURL',
      'defaultMessage',
      'includeDefaultMessage',
      'desktopNotifsEnabled',
      'phoneNotifsEnabled',
      'insights',
    ]);

    if (userResponse === null || userResponse === undefined) {
      console.error(ERROR_MESSAGES.profileController.userResponseNotFound);
      throw new HttpException(
        ERROR_MESSAGES.profileController.userResponseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const pendingCourses = await this.profileService.getPendingCourses(user.id);
    const hasUnregisteredCourses = await this.profileService.hasUnregisteredCourses(user.id);

    return {
      ...userResponse,
      courses,
      phoneNumber: user.phoneNotif?.phoneNumber,
      desktopNotifs,
      pendingCourses,
      hasUnregisteredCourses,
    };
  }

  @Post('/reset_registration')
  async resetRegistration(@User() user: UserModel): Promise<void> {
    await this.profileService.resetRegistration(user.id);
  }

  @Patch()
  async patch(
    @Body() userPatch: UpdateProfileParams,
    @User(['courses', 'courses.course', 'phoneNotif', 'desktopNotifs'])
    user: UserModel,
  ): Promise<GetProfileResponse> {
    user = Object.assign(user, userPatch);

    await user.save();

    return this.get(user);
  }

  @Post('/upload_picture')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @User() user: UserModel,
  ): Promise<void> {
    if (!file) {
      throw new BadRequestException('No image file was uploaded');
    }

    const spaceLeft = await checkDiskSpace(path.parse(process.cwd()).root);
    if (spaceLeft.free < 1000000000) {
      // if less than a gigabyte left
      throw new ServiceUnavailableException(
        ERROR_MESSAGES.profileController.noDiskSpace,
      );
    }

    const fileName = customPhotoFileName(user.id);
    try {
      await savePhotoBuffer(file.buffer, fileName);
    } catch (err) {
      throw new BadRequestException('The uploaded file is not a valid image');
    }

    const previous = user.photoURL;
    user.photoURL = fileName;
    await user.save();
    if (previous && isCustomPhoto(previous)) {
      deletePhotoFile(previous);
    }
  }

  @Get('/get_picture/:photoURL')
  async getImage(
    @Param('photoURL') photoURL: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!isSafePhotoFileName(photoURL)) {
      throw new NotFoundException();
    }
    fs.stat(path.join(uploadDir(), photoURL), (err) => {
      if (err) {
        res.status(HttpStatus.NOT_FOUND).send();
      } else {
        res.sendFile(photoURL, { root: uploadDir() });
      }
    });
  }

  @Delete('/delete_profile_picture')
  async deleteProfilePicture(@User() user: UserModel): Promise<void> {
    if (!user.photoURL) {
      return;
    }
    const previous = user.photoURL;
    user.photoURL = null;
    await user.save();
    if (isCustomPhoto(previous)) {
      deletePhotoFile(previous);
    }
  }
}
