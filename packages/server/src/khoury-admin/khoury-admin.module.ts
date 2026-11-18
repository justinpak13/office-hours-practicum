import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { LoginCourseService } from '../login/login-course.service';
import { KhouryAdminSyncService } from './khoury-admin-sync.service';
import { KhouryAdminClient } from './khoury-admin.client';

@Module({
  imports: [HttpModule],
  providers: [KhouryAdminClient, KhouryAdminSyncService, LoginCourseService],
  exports: [KhouryAdminClient, KhouryAdminSyncService],
})
export class KhouryAdminModule {}
