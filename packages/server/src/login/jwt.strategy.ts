import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => req.cookies['auth_token'],
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  validate(payload: { userId: number; token_type?: string }): any {
    // Only accept long-lived auth tokens as the session cookie; this also
    // invalidates all pre-token_type tokens, which were issued without an
    // expiration date
    if (!payload || payload.token_type !== 'auth') {
      return null;
    }
    return { ...payload };
  }
}
