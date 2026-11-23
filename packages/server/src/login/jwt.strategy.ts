import { Strategy as PassportBaseStrategy } from 'passport';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { OidcTokenService } from '../oidc/oidc-token.service';
import { OidcUserService } from '../oidc/oidc-user.service';

// passport's own Request type (from its copy of @types/express)
type PassportRequest = Parameters<
  InstanceType<typeof PassportBaseStrategy>['authenticate']
>[0];

// Passes the whole request to the verify callback, like passport-custom
class RequestStrategy extends PassportBaseStrategy {
  constructor(
    private verify: (
      req: Request,
      done: (err: unknown, user?: unknown) => void,
    ) => void,
  ) {
    super();
  }

  authenticate(req: PassportRequest): void {
    this.verify(req as unknown as Request, (err, user) => {
      if (err) return this.error(err);
      if (!user) return this.fail(401);
      this.success(user);
    });
  }
}

export interface AuthenticatedUser {
  userId: number;
}

// Registered as 'jwt', so every @UseGuards(JwtAuthGuard) uses it. A request is
// logged in by either:
// 1. the `auth_token` cookie set by /login/entry (Khoury Admin Portal) or
//    /login/dev. It wins when present, so dev login can act as any seeded user
//    even through oauth2-proxy.
// 2. the Keycloak ID token oauth2-proxy sends in `Authorization: Bearer …`.
@Injectable()
export class JwtStrategy extends PassportStrategy(RequestStrategy, 'jwt') {
  constructor(
    private jwtService: JwtService,
    private oidcTokenService: OidcTokenService,
    private oidcUserService: OidcUserService,
  ) {
    super();
  }

  async validate(req: Request): Promise<AuthenticatedUser> {
    const cookieUserId = await this.userIdFromCookie(req.cookies?.auth_token);
    if (cookieUserId !== null) {
      return { userId: cookieUserId };
    }

    // Throws 401 if the token is missing or fails any check
    const claims = await this.oidcTokenService.verify(
      req.headers.authorization,
    );
    const user = await this.oidcUserService.findOrCreate(claims);
    return { userId: user.id };
  }

  private async userIdFromCookie(token?: string): Promise<number | null> {
    if (!token) return null;
    try {
      const payload = await this.jwtService.verifyAsync<{
        userId: number;
        token_type?: string;
      }>(token, { algorithms: ['HS256'] });
      // Only long-lived auth tokens are sessions, not 60-second login tokens.
      // This also rejects old tokens issued without token_type or expiry.
      return payload?.token_type === 'auth' ? payload.userId : null;
    } catch {
      return null;
    }
  }
}
