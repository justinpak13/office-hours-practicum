import { Module } from '@nestjs/common';
import { LoginController } from './login.controller';
import { JwtStrategy } from '../login/jwt.strategy';
import { LoginCourseService } from './login-course.service';
import { KhouryAdminModule } from '../khoury-admin/khoury-admin.module';
import { OidcModule } from '../oidc/oidc.module';

@Module({
  imports: [OidcModule, KhouryAdminModule],
  controllers: [LoginController],
  providers: [JwtStrategy, LoginCourseService],
})
export class LoginModule {}
