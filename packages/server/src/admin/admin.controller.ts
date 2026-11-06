import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  CourseAdmin,
  QueueAdmin,
  UserAdmin,
  UserCourseAdmin,
  CourseSectionMappingAdmin,
  SemesterAdmin,
} from './admin-entities';
import { AdminResource } from './admin-resource';
import { AdminGuard } from './admin-auth';

@Controller('admin')
@UseGuards(AdminGuard) // nestjs-admin had its own login; you need a replacement
export class AdminController {
  private readonly resources: Record<string, AdminResource<any>>;

  constructor(
    course: CourseAdmin,
    queue: QueueAdmin,
    user: UserAdmin,
    userCourse: UserCourseAdmin,
    mapping: CourseSectionMappingAdmin,
    semester: SemesterAdmin,
  ) {
    this.resources = {
      course,
      queue,
      user,
      usercourse: userCourse,
      mapping,
      semester,
    };
  }

  @Get(':resource')
  list(
    @Param('resource') name: string,
    @Query('page') page = '1',
    @Query('search') search = '',
  ) {
    const resource = this.resources[name];
    if (!resource) throw new NotFoundException();
    return resource.getEntityList(Number(page) || 1, search);
  }
}
