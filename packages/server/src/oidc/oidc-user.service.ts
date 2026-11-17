import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserModel } from '../profile/user.entity';
import { OidcClaims } from './oidc-token.service';

@Injectable()
export class OidcUserService {
  // Finds the user with this Keycloak `sub`, creating them on their first
  // login. Users are never linked to existing accounts by email: existing data
  // will be rehydrated once the new data endpoint exists.
  async findOrCreate(claims: OidcClaims): Promise<UserModel> {
    // UserModel.email is required, and only a verified email can be trusted.
    // oauth2-proxy already refuses unverified emails, so this is a backstop.
    if (claims.email_verified !== true || !claims.email) {
      throw new UnauthorizedException('Keycloak email is not verified');
    }
    const profile = {
      email: claims.email.toLowerCase(),
      firstName: claims.given_name ?? null,
      lastName: claims.family_name ?? null,
    };

    let user = await UserModel.findOne({ where: { keycloakSub: claims.sub } });
    if (!user) {
      // A page load sends several requests at once, so two of them can both
      // see no user. orIgnore lets the unique index keep exactly one.
      await UserModel.createQueryBuilder()
        .insert()
        .values({ ...profile, keycloakSub: claims.sub, hideInsights: [] })
        .orIgnore()
        .execute();
      return UserModel.findOneOrFail({ where: { keycloakSub: claims.sub } });
    }

    // Email and name can change in Keycloak, so keep them in sync
    if (
      user.email !== profile.email ||
      user.firstName !== profile.firstName ||
      user.lastName !== profile.lastName
    ) {
      await UserModel.update(user.id, profile);
      user = await UserModel.findOneOrFail({ where: { id: user.id } });
    }
    return user;
  }
}
