import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync, KeyObject } from 'crypto';
import { OidcTokenService } from './oidc-token.service';

const ISSUER = 'http://keycloak.test/realms/test';
const CLIENT_ID = 'test-officehours';
const JWKS_URI = `${ISSUER}/protocol/openid-connect/certs`;

function newKey(): { privateKey: KeyObject; publicKey: KeyObject } {
  return generateKeyPairSync('rsa', { modulusLength: 2048 });
}

describe('OidcTokenService', () => {
  const jwt = new JwtService({});
  let service: OidcTokenService;
  let fetchMock: jest.SpyInstance;
  // The keys the fake Keycloak publishes, by kid
  let published: Record<string, KeyObject>;
  const key1 = newKey();

  // Serves the discovery document and the published keys
  function serveKeycloak() {
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (url: string | URL | Request) => {
        const body =
          String(url) === `${ISSUER}/.well-known/openid-configuration`
            ? { issuer: ISSUER, jwks_uri: JWKS_URI }
            : {
                keys: Object.entries(published).map(([kid, publicKey]) => ({
                  ...publicKey.export({ format: 'jwk' }),
                  kid,
                  use: 'sig',
                  alg: 'RS256',
                })),
              };
        return new Response(JSON.stringify(body), { status: 200 });
      });
  }

  function claims(overrides: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000);
    return {
      sub: 'f3b3c0de-0000-4000-8000-000000000001',
      iss: ISSUER,
      aud: CLIENT_ID,
      azp: CLIENT_ID,
      iat: now,
      exp: now + 300,
      email: 'student@northeastern.edu',
      email_verified: true,
      ...overrides,
    };
  }

  function sign(
    payload: Record<string, unknown> = claims(),
    { kid = 'key1', privateKey = key1.privateKey } = {},
  ) {
    return jwt.sign(payload, {
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      algorithm: 'RS256',
      keyid: kid,
    });
  }

  beforeEach(() => {
    published = { key1: key1.publicKey };
    serveKeycloak();
    service = new OidcTokenService(
      new ConfigService({ OIDC_ISSUER_URL: ISSUER, OIDC_CLIENT_ID: CLIENT_ID }),
    );
    // Rejections log a warning; keep test output quiet
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function expectRejected(header: string | undefined) {
    await expect(service.verify(header)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  }

  it('returns the claims of a valid token', async () => {
    const result = await service.verify(`Bearer ${sign()}`);
    expect(result).toMatchObject({
      sub: 'f3b3c0de-0000-4000-8000-000000000001',
      email: 'student@northeastern.edu',
    });
  });

  it('fetches the keys once and reuses them', async () => {
    await service.verify(`Bearer ${sign()}`);
    await service.verify(`Bearer ${sign()}`);
    // discovery + JWKS
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refetches the keys when Keycloak rotates them', async () => {
    await service.verify(`Bearer ${sign()}`);
    const key2 = newKey();
    published = { key2: key2.publicKey };
    const token = sign(claims(), { kid: 'key2', privateKey: key2.privateKey });
    await expect(service.verify(`Bearer ${token}`)).resolves.toBeDefined();
  });

  it('rejects a missing or malformed Authorization header', async () => {
    await expectRejected(undefined);
    await expectRejected('');
    await expectRejected(sign());
    await expectRejected(`Basic ${sign()}`);
    await expectRejected('Bearer not-a-jwt');
  });

  it('rejects a token signed by a different key', async () => {
    await expectRejected(
      `Bearer ${sign(claims(), { privateKey: newKey().privateKey })}`,
    );
  });

  it('rejects a token with an unknown kid', async () => {
    await expectRejected(`Bearer ${sign(claims(), { kid: 'other' })}`);
  });

  it('rejects HS256 signed with the public key as the secret', async () => {
    const forged = jwt.sign(claims(), {
      secret: key1.publicKey.export({ type: 'spki', format: 'pem' }),
      algorithm: 'HS256',
      keyid: 'key1',
    });
    await expectRejected(`Bearer ${forged}`);
  });

  it('rejects an unsigned token', async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', kid: 'key1' }),
    ).toString('base64url');
    const body = Buffer.from(JSON.stringify(claims())).toString('base64url');
    await expectRejected(`Bearer ${header}.${body}.`);
  });

  it('rejects the wrong issuer', async () => {
    await expectRejected(
      `Bearer ${sign(claims({ iss: 'http://evil.test/realms/test' }))}`,
    );
  });

  it('rejects the wrong audience', async () => {
    await expectRejected(`Bearer ${sign(claims({ aud: 'other-app' }))}`);
  });

  it('rejects the wrong azp', async () => {
    await expectRejected(`Bearer ${sign(claims({ azp: 'other-app' }))}`);
  });

  it('rejects a token without a sub', async () => {
    await expectRejected(`Bearer ${sign(claims({ sub: undefined }))}`);
  });

  it('allows 30 seconds of clock difference on expiry, and no more', async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(
      service.verify(`Bearer ${sign(claims({ exp: now - 20 }))}`),
    ).resolves.toBeDefined();
    await expectRejected(`Bearer ${sign(claims({ exp: now - 60 }))}`);
  });
});
