import { Module } from '@nestjs/common';
import { LoginController } from './login.controller';
import { JwtStrategy } from '../login/jwt.strategy';
import { LoginCourseService } from './login-course.service';
import { OidcModule } from '../oidc/oidc.module';

@Module({
  imports: [OidcModule],
  controllers: [LoginController],
  providers: [JwtStrategy, LoginCourseService],
})
export class LoginModule {}
