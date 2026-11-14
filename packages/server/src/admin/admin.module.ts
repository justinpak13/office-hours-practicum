// admin/admin.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUserModel } from './admin-user.entity';
import { CourseModel } from '../course/course.entity';
import { QueueModel } from '../queue/queue.entity';
import { UserModel } from '../profile/user.entity';
import { UserCourseModel } from '../profile/user-course.entity';
import { CourseSectionMappingModel } from '../login/course-section-mapping.entity';
import { SemesterModel } from '../semester/semester.entity';
import {
  CourseAdmin,
  QueueAdmin,
  UserAdmin,
  UserCourseAdmin,
  CourseSectionMappingAdmin,
  SemesterAdmin,
} from './admin-entities';
import {
  AdminAuthController,
  AdminAuthService,
  AdminGuard,
} from './admin-auth';
import { AdminController } from './admin.controller';
import { AdminOverviewController } from './admin-overview.controller';
import { AdminCommand } from './admin.command';
import { createAdminSession } from './admin-session';
import { RedisModule, RedisService } from '../redis/redis.module';

@Module({
  imports: [
    // Imported here (not only globally) so tests that load AdminModule on its
    // own can still inject RedisService
    RedisModule,
    TypeOrmModule.forFeature([
      AdminUserModel,
      CourseModel,
      QueueModel,
      UserModel,
      UserCourseModel,
      CourseSectionMappingModel,
      SemesterModel,
    ]),
  ],
  providers: [
    AdminCommand,
    AdminAuthService,
    AdminGuard,
    CourseAdmin,
    QueueAdmin,
    UserAdmin,
    UserCourseAdmin,
    CourseSectionMappingAdmin,
    SemesterAdmin,
  ],
  controllers: [AdminAuthController, AdminOverviewController, AdminController],
})
export class AdminModule implements NestModule {
  constructor(private readonly redis: RedisService) {}

  configure(consumer: MiddlewareConsumer) {
    // Scope the session to the admin controllers only, so the rest of the
    // app is unaffected and Redis is never touched outside /admin
    consumer
      .apply(createAdminSession(this.redis.getClient('db')))
      .forRoutes(AdminAuthController, AdminOverviewController, AdminController);
  }
}
