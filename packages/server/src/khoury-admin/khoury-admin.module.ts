import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { KhouryAdminClient } from './khoury-admin.client';

@Module({
  imports: [HttpModule],
  providers: [KhouryAdminClient],
  exports: [KhouryAdminClient],
})
export class KhouryAdminModule {}
