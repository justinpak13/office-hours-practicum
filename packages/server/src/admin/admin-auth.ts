// admin/admin-auth.ts
import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  HttpCode,
  Injectable,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { compare } from 'bcrypt';
import { AdminUserModel } from './admin-user.entity';

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUserModel)
    private readonly adminUsers: Repository<AdminUserModel>,
  ) {}

  async validate(username: string, password: string) {
    const user = await this.adminUsers.findOne({ where: { username } });
    if (!user) return null;
    // Replace with the check from credentialValidator.ts
    return (await compare(password, user.passwordHash)) ? user : null;
  }
}

@Controller('admin')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  @HttpCode(204)
  async login(
    @Body() body: { username: string; password: string },
    @Req() req: Request,
  ) {
    const user = await this.auth.validate(body.username, body.password);
    if (!user) throw new UnauthorizedException();
    // New session ID on login prevents session fixation
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    req.session.adminUserId = user.id;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Req() req: Request) {
    return new Promise<void>((resolve, reject) =>
      req.session.destroy((err) => (err ? reject(err) : resolve())),
    );
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    return Boolean(req.session?.adminUserId);
  }
}
