import {
  ConsoleLogger,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createPublicKey } from 'crypto';

// One entry of Keycloak's JWKS (its public signing keys)
interface Jwk {
  kid: string;
  kty: string;
  use?: string;
  n: string;
  e: string;
}

// The claims Keycloak puts in an ID token that we care about
export interface OidcClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  azp?: string;
  exp: number;
  iat: number;
  auth_time?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  [claim: string]: unknown;
}

// Verifies the ID token that oauth2-proxy forwards in `Authorization: Bearer …`
@Injectable()
export class OidcTokenService {
  private readonly logger = new ConsoleLogger(OidcTokenService.name);
  // Keycloak's public signing keys as PEM, by key ID (`kid`)
  private keys = new Map<string, string>();
  // Private instance with no default secret: every verify passes Keycloak's
  // public key, so a token signed with JWT_SECRET can never pass here. Not
  // injected, so LoginModule's JwtService stays the only one in the app.
  private jwtService = new JwtService({});

  constructor(private configService: ConfigService) {}

  private get issuer(): string {
    const issuer = this.configService.get<string>('OIDC_ISSUER_URL');
    if (!issuer) throw new Error('OIDC_ISSUER_URL must be set');
    return issuer;
  }

  private get clientId(): string {
    const clientId = this.configService.get<string>('OIDC_CLIENT_ID');
    if (!clientId) throw new Error('OIDC_CLIENT_ID must be set');
    return clientId;
  }

  // Returns the token's claims, or throws 401 if any check fails
  async verify(authorizationHeader: string | undefined): Promise<OidcClaims> {
    const match = /^Bearer (\S+)$/.exec(authorizationHeader ?? '');
    if (!match) {
      throw new UnauthorizedException('Missing Authorization: Bearer token');
    }
    const token = match[1];

    try {
      const decoded = this.jwtService.decode(token, { complete: true });
      const kid = decoded?.header?.kid;
      if (!kid) throw new Error('token has no kid');

      const claims = await this.jwtService.verifyAsync<OidcClaims>(token, {
        publicKey: await this.getKey(kid),
        algorithms: ['RS256'],
        issuer: this.issuer,
        audience: this.clientId,
        clockTolerance: 30,
      });
      if (claims.azp !== this.clientId) throw new Error('azp mismatch');
      if (!claims.sub) throw new Error('token has no sub');
      return claims;
    } catch (err) {
      this.logger.warn(`token rejected: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  // Logs the token's claims in a readable form
  printClaims(claims: OidcClaims): void {
    const time = (t?: number) =>
      t === undefined ? '-' : `${new Date(t * 1000).toISOString()} (${t})`;
    const lines = [
      `sub                ${claims.sub}`,
      `email              ${claims.email ?? '-'}`,
      `email_verified     ${claims.email_verified ?? '-'}`,
      `name               ${claims.name ?? '-'}`,
      `preferred_username ${claims.preferred_username ?? '-'}`,
      `iss                ${claims.iss}`,
      `aud                ${claims.aud}`,
      `azp                ${claims.azp}`,
      `issued at          ${time(claims.iat)}`,
      `expires at         ${time(claims.exp)}`,
      `last login         ${time(claims.auth_time)}`,
    ];
    this.logger.log(`Verified ID token:\n  ${lines.join('\n  ')}`);
  }

  // Keycloak rotates its keys, so on an unknown kid, refetch them once
  private async getKey(kid: string): Promise<string> {
    if (!this.keys.has(kid)) await this.fetchKeys();
    const key = this.keys.get(kid);
    if (!key) throw new Error(`no signing key with kid ${kid}`);
    return key;
  }

  private async fetchKeys(): Promise<void> {
    const discovery = await this.getJson<{ jwks_uri: string }>(
      `${this.issuer}/.well-known/openid-configuration`,
    );
    const { keys } = await this.getJson<{ keys: Jwk[] }>(discovery.jwks_uri);
    this.keys = new Map(
      keys
        .filter((jwk) => jwk.kty === 'RSA' && (jwk.use ?? 'sig') === 'sig')
        .map((jwk) => [
          jwk.kid,
          createPublicKey({ key: { ...jwk }, format: 'jwk' })
            .export({ type: 'spki', format: 'pem' })
            .toString(),
        ]),
    );
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`GET ${url} returned ${res.status}`);
    return (await res.json()) as T;
  }
}
