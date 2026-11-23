import { Strategy as PassportBaseStrategy } from 'passport';
import { PassportStrategy } from '@nestjs/passport';
import { ConsoleLogger, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { KhouryAdminSyncService } from '../khoury-admin/khoury-admin-sync.service';
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

// Registered as 'jwt', so every @UseGuards(JwtAuthGuard) uses it. A request
// is logged in only by the Keycloak ID token that oauth2-proxy sends in
// `Authorization: Bearer …`.
@Injectable()
export class JwtStrategy extends PassportStrategy(RequestStrategy, 'jwt') {
  constructor(
    private oidcTokenService: OidcTokenService,
    private oidcUserService: OidcUserService,
    private khouryAdminSync: KhouryAdminSyncService,
  ) {
    super();
  }

  private readonly logger = new ConsoleLogger(JwtStrategy.name);

  async validate(req: Request): Promise<AuthenticatedUser> {
    // Throws 401 if the token is missing or fails any check
    const claims = await this.oidcTokenService.verify(
      req.headers.authorization,
    );
    const user = await this.oidcUserService.findOrCreate(claims);
    // Background sync (gated to once a day): login never waits on it or fails from it
    void this.khouryAdminSync
      .syncIfDue(user)
      .catch((e) => this.logger.warn(`Khoury Admin sync failed: ${e}`));
    return { userId: user.id };
  }
}
