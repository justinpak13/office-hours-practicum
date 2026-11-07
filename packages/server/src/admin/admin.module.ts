import { Module } from '@nestjs/common';
import {
  AdminCoreModuleFactory,
  AdminAuthModuleFactory,
  DefaultAdminSite,
  DefaultAdminNunjucksEnvironment,
} from 'nestjs-admin';
import { adminCredentialValidator } from './credentialValidator';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUserModel } from './admin-user.entity';
import {
  CourseAdmin,
  QueueAdmin,
  UserAdmin,
  UserCourseAdmin,
  CourseSectionMappingAdmin,
  SemesterAdmin,
} from './admin-entities';
import { AdminCommand } from './admin.command';
import { AdminOverviewController } from './admin-overview.controller';
import * as session from 'express-session';
import * as connectRedis from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  // Retry indefinitely so the app recovers from a Redis restart on its own
  retry_strategy: (options) => Math.min(options.attempt * 100, 3000),
});
// Without an error listener, a Redis outage crashes the process via an
// unhandled 'error' event
redisClient.on('error', (err) =>
  console.error('Admin session Redis error:', err),
);
const RedisStore = connectRedis(session);

// This stops redisClient from causing jest tests to hang from an open handler
// We only use redisClient in the admin module, which isn't needed for our tests
if (process.env.NODE_ENV === 'test') {
  redisClient.quit();
}

const CoreModule = AdminCoreModuleFactory.createAdminCoreModule({
  appConfig: {
    session: {
      store: new RedisStore({ client: redisClient }),
      // Without this the library falls back to its default secret ('secret'),
      // which lets anyone forge an admin session cookie
      secret: process.env.ADMIN_SESSION_SECRET,
    },
  },
});
const AuthModule = AdminAuthModuleFactory.createAdminAuthModule({
  adminCoreModule: CoreModule,
  credentialValidator: adminCredentialValidator, // how do you validate credentials
  imports: [TypeOrmModule.forFeature([AdminUserModel])], // what modules export the dependencies of the credentialValidator available
  providers: [],
});

// The library's navbar template, plus a link to the custom courses overview
// page. Served by a prepended nunjucks loader so every admin page picks it up
// without patching node_modules.
const headerWithOverviewLink = `<nav class="admin-header navbar navbar-dark bg-dark">
  <a class="navbar-brand mb-0 h1" href="{{ 'index' | adminUrl() }}">{{ adminSite.siteHeader }}</a>
  <div class="d-flex align-items-center">
    <a class="btn btn-outline-light btn-sm" style="margin-right: 1rem" href="/admin/overview">Courses overview</a>
    {% if request.user %}
      <form action="{{ "logout" | adminUrl() }}" method="POST" style="margin: 0">
        <button type="submit" class="admin-header__logout">Logout</button>
      </form>
    {% endif %}
  </div>
</nav>`;

@Module({
  imports: [CoreModule, AuthModule],
  exports: [CoreModule, AuthModule],
  providers: [AdminCommand],
  controllers: [AdminOverviewController],
})
export class AdminModule {
  constructor(
    private readonly adminSite: DefaultAdminSite,
    adminEnv: DefaultAdminNunjucksEnvironment,
  ) {
    adminSite.register('Course', CourseAdmin);
    adminSite.register('User', UserAdmin);
    adminSite.register('UserCourse', UserCourseAdmin);
    adminSite.register('Queue', QueueAdmin);
    adminSite.register('CourseSectionMapping', CourseSectionMappingAdmin);
    adminSite.register('Semester', SemesterAdmin);

    (adminEnv.env as any).loaders.unshift({
      cache: {},
      getSource: (name: string) =>
        name === 'header.njk'
          ? { src: headerWithOverviewLink, path: name, noCache: true }
          : null,
    });
  }
}
