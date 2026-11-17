import { Module } from '@nestjs/common';
import { OidcDebugController } from './oidc-debug.controller';
import { OidcTokenService } from './oidc-token.service';
import { OidcUserService } from './oidc-user.service';

@Module({
  controllers: [OidcDebugController],
  providers: [OidcTokenService, OidcUserService],
  exports: [OidcTokenService, OidcUserService],
})
export class OidcModule {}
