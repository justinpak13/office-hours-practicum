import { UnauthorizedException } from '@nestjs/common';
import { OidcClaims, OidcTokenService } from 'oidc/oidc-token.service';
import { UserModel } from 'profile/user.entity';
import { ProfileModule } from '../src/profile/profile.module';
import { UserFactory } from './util/factories';
import { setupIntegrationTest } from './util/testUtils';

// Token checks are covered in oidc-token.service.spec.ts. Here the stub treats
// `Bearer <name>` as a valid token for the claims in `tokens[name]`.
let tokens: Record<string, Partial<OidcClaims>> = {};
const oidcTokenStub = {
  verify: async (header?: string) => {
    const claims = tokens[header?.replace(/^Bearer /, '') ?? ''];
    if (!claims) throw new UnauthorizedException('Invalid token');
    return claims;
  },
};

const jordan = {
  sub: '2a99da1b-bc99-47fd-ad46-280fba3941a3',
  email: 'Rivera.Jo@northeastern.edu',
  email_verified: true,
  given_name: 'Jordan',
  family_name: 'Rivera',
  nuid: '000000001',
};

describe('Keycloak login (oauth2-proxy)', () => {
  const supertest = setupIntegrationTest(ProfileModule, (t) =>
    t.overrideProvider(OidcTokenService).useValue(oidcTokenStub),
  );

  beforeEach(() => {
    tokens = { jordan };
  });

  const getProfile = (token: string) =>
    supertest().get('/profile').set('Authorization', `Bearer ${token}`);

  it('creates a user on their first request, keyed by sub', async () => {
    const res = await getProfile('jordan').expect(200);
    expect(res.body).toMatchObject({
      email: 'rivera.jo@northeastern.edu',
      firstName: 'Jordan',
      lastName: 'Rivera',
      courses: [],
    });
    expect(res.body.keycloakSub).toBeUndefined();
    expect(res.body.nuid).toBeUndefined();

    const user = await UserModel.findOneOrFail({
      where: { keycloakSub: jordan.sub },
    });
    expect(user.id).toEqual(res.body.id);
    expect(user.nuid).toEqual('000000001');
  });

  it('stores a null nuid when the token has none', async () => {
    tokens.nonuid = { ...jordan, nuid: undefined };
    await getProfile('nonuid').expect(200);
    const user = await UserModel.findOneOrFail({
      where: { keycloakSub: jordan.sub },
    });
    expect(user.nuid).toBeNull();
  });

  it('updates the nuid from the token', async () => {
    tokens.nonuid = { ...jordan, nuid: undefined };
    await getProfile('nonuid').expect(200);
    await getProfile('jordan').expect(200);
    const user = await UserModel.findOneOrFail({
      where: { keycloakSub: jordan.sub },
    });
    expect(user.nuid).toEqual('000000001');
  });

  it('reuses the same user on later requests', async () => {
    await getProfile('jordan').expect(200);
    await getProfile('jordan').expect(200);
    expect(await UserModel.count()).toEqual(1);
  });

  it('creates only one user for concurrent first requests', async () => {
    await Promise.all([1, 2, 3, 4].map(() => getProfile('jordan').expect(200)));
    expect(await UserModel.count()).toEqual(1);
  });

  it('updates email and name from the token', async () => {
    await getProfile('jordan').expect(200);
    tokens.jordan = {
      ...jordan,
      email: 'j.rivera@northeastern.edu',
      family_name: 'Rivera-Lee',
    };
    const res = await getProfile('jordan').expect(200);
    expect(res.body).toMatchObject({
      email: 'j.rivera@northeastern.edu',
      lastName: 'Rivera-Lee',
    });
    expect(await UserModel.count()).toEqual(1);
  });

  it('does not link to an existing user with the same email', async () => {
    const existing = await UserFactory.create({
      email: 'rivera.jo@northeastern.edu',
    });
    const res = await getProfile('jordan').expect(200);
    expect(res.body.id).not.toEqual(existing.id);
    expect(
      (await UserModel.findOneOrFail({ where: { id: existing.id } }))
        .keycloakSub,
    ).toBeNull();
  });

  it('rejects an unverified email', async () => {
    tokens.unverified = { ...jordan, email_verified: false };
    await getProfile('unverified').expect(401);
    expect(await UserModel.count()).toEqual(0);
  });

  it('rejects an invalid token and a request with no login', async () => {
    await getProfile('forged').expect(401);
    await supertest().get('/profile').expect(401);
  });

  it('lets the dev login cookie win over the Keycloak token', async () => {
    const devUser = await UserFactory.create();
    const res = await supertest({ userId: devUser.id })
      .get('/profile')
      .set('Authorization', 'Bearer jordan')
      .expect(200);
    expect(res.body.id).toEqual(devUser.id);
    expect(await UserModel.count()).toEqual(1);
  });

  it('keeps POST /khoury_login away from Keycloak users', async () => {
    await getProfile('jordan').expect(200);
    await supertest()
      .post('/khoury_login')
      .send({
        email: 'rivera.jo@northeastern.edu',
        campus: 1,
        first_name: 'Jordan',
        last_name: 'Rivera',
        courses: [],
      })
      .expect(201);

    const users = await UserModel.find({
      where: { email: 'rivera.jo@northeastern.edu' },
    });
    expect(users.map((u) => u.keycloakSub).sort()).toEqual([jordan.sub, null]);
  });
});
