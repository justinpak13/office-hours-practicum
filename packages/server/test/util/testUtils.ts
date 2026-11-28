import { INestApplication, Type, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { RedisModule } from '../../src/redis/redis.module';
import { NotificationService } from 'notification/notification.service';
import * as supertest from 'supertest';
import { DataSource } from 'typeorm';
import { addGlobalsToApp } from '../../src/app-globals';
import { LoginModule } from '../../src/login/login.module';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testDb';
import { resetUserSeq } from './factories';
import { QueueSSEService } from '../../src/queue/queue-sse.service';
import {
  OidcClaims,
  OidcTokenService,
} from '../../src/oidc/oidc-token.service';
import { OidcUserService } from '../../src/oidc/oidc-user.service';
import { UserModel } from '../../src/profile/user.entity';

export interface SupertestOptions {
  userId?: number;
}
export type ModuleModifier = (t: TestingModuleBuilder) => TestingModuleBuilder;

// supertest({ userId }) sends `Authorization: Bearer test-user:<id>`. These
// stubs stand in for oauth2-proxy and Keycloak: the token stub accepts only
// that form, and the user stub maps it to the user with that ID.
// Any other claims go to the real OidcUserService. Tests that cover token
// handling override OidcTokenService themselves (see oidc.integration.ts).
const TEST_TOKEN = /^Bearer test-user:(\d+)$/;
const testOidcTokenService = {
  verify: async (header?: string): Promise<Partial<OidcClaims>> => {
    const match = TEST_TOKEN.exec(header ?? '');
    if (!match) throw new UnauthorizedException('Invalid token');
    return { sub: `test-user:${match[1]}`, testUserId: Number(match[1]) };
  },
};
class TestOidcUserService extends OidcUserService {
  async findOrCreate(claims: OidcClaims): Promise<UserModel> {
    // JwtStrategy only reads the ID. Like the old cookie login, the user
    // doesn't have to exist: some tests use a missing ID to check 401s/404s.
    if (typeof claims.testUserId === 'number') {
      return { id: claims.testUserId } as UserModel;
    }
    return super.findOrCreate(claims);
  }
}

export function setupIntegrationTest(
  module: Type<any>,
  modifyModule?: ModuleModifier,
): (u?: SupertestOptions) => supertest.SuperTest<supertest.Test> {
  let app: INestApplication;
  let conn: DataSource;
  let queueSSE: QueueSSEService | undefined;

  beforeAll(async () => {
    let testModuleBuilder = Test.createTestingModule({
      imports: [
        module,
        LoginModule,
        TestTypeOrmModule,
        TestConfigModule,
        RedisModule,
      ],
    })
      .overrideProvider(OidcTokenService)
      .useValue(testOidcTokenService)
      .overrideProvider(OidcUserService)
      .useClass(TestOidcUserService);

    if (modifyModule) {
      testModuleBuilder = modifyModule(testModuleBuilder);
    }
    const testModule = await testModuleBuilder.compile();

    app = testModule.createNestApplication();
    addGlobalsToApp(app);
    conn = testModule.get<DataSource>(DataSource);
    try {
      queueSSE = testModule.get(QueueSSEService, { strict: false });
    } catch {
      queueSSE = undefined; // this test module doesn't include the queue module
    }
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  afterEach(async () => {
    // Let throttled SSE updates finish while the tables still exist
    await queueSSE?.flushPendingUpdates();
  });

  beforeEach(async () => {
    await conn.synchronize(true);
    resetUserSeq();
  });

  return (options?: SupertestOptions): supertest.SuperTest<supertest.Test> => {
    const agent = supertest.agent(app.getHttpServer());
    if (options?.userId) {
      agent.set('Authorization', `Bearer test-user:${options.userId}`);
    }
    return agent;
  };
}

const notifMock = jest.mocked({ notifyUser: jest.fn(() => Promise.resolve()) });
/**
 * Module Modifier tests can pass to setupIntegrationTest to mock the notifService and to expect things
 * ex:
 * const supertest = setupIntegrationTest(QuestionModule, modifyMockNotifs);
 */

export const modifyMockNotifs: ModuleModifier = (t) =>
  t.overrideProvider(NotificationService).useValue(notifMock);
export const expectUserNotified = (userId: number): void =>
  expect(notifMock.notifyUser).toHaveBeenCalledWith(userId, expect.any(String));
export * from './testDb';
