import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsightsModule } from 'insights/insights.module';
import { AlertsModule } from 'alerts/alerts.module';
import { BackfillModule } from 'backfill/backfill.module';
import { CommandModule } from 'nestjs-command';
import { RedisModule } from './redis/redis.module';
import { ormconfig } from '../ormconfig';
import { AdminModule } from './admin/admin.module';
import { CourseModule } from './course/course.module';
import { HealthcheckModule } from './healthcheck/healthcheck.module';
import { LoginModule } from './login/login.module';
import { NotificationModule } from './notification/notification.module';
import { ProfileModule } from './profile/profile.module';
import { QuestionModule } from './question/question.module';
import { QueueModule } from './queue/queue.module';
import { SeedModule } from './seed/seed.module';
import { SSEModule } from './sse/sse.module';
import { SemesterModule } from 'semester/semester.module';
import { ResourcesModule } from './resources/resources.module';
import { OidcModule } from './oidc/oidc.module';

@Module({
  imports: [
    // Must come first so Sentry can name transactions by route
    SentryModule.forRoot(),
    TypeOrmModule.forRoot(ormconfig),
    ScheduleModule.forRoot(),
    LoginModule,
    ProfileModule,
    CourseModule,
    QueueModule,
    NotificationModule,
    QuestionModule,
    SeedModule,
    ResourcesModule,
    ConfigModule.forRoot({
      envFilePath: [
        '.env',
        ...(process.env.NODE_ENV !== 'production' ? ['.env.development'] : []),
      ],
      isGlobal: true,
    }),
    AdminModule,
    CommandModule,
    SSEModule,
    BackfillModule,
    InsightsModule,
    // Only use 'pub' for publishing events, 'sub' for subscribing, and 'db' for writing to key/value store
    RedisModule,
    HealthcheckModule,
    AlertsModule,
    SemesterModule,
    OidcModule,
  ],
  providers: [
    // Reports unhandled (non-HttpException) errors to Sentry, then falls back
    // to Nest's default error response. Register before any other filters.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
  ],
})
export class AppModule {}
