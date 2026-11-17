import { Controller, Get, Headers, UseGuards } from '@nestjs/common';
import { NonProductionGuard } from '../guards/non-production.guard';
import { OidcClaims, OidcTokenService } from './oidc-token.service';

// Development only: open https://localhost:4443/api/v1/oidc/token-info through
// oauth2-proxy to see the claims in the token it forwards
@Controller('oidc')
export class OidcDebugController {
  constructor(private oidcTokenService: OidcTokenService) {}

  @Get('token-info')
  @UseGuards(NonProductionGuard)
  async tokenInfo(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<OidcClaims> {
    const claims = await this.oidcTokenService.verify(authorization);
    this.oidcTokenService.printClaims(claims);
    return claims;
  }
}
