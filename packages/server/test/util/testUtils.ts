import { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { RedisModule } from '../../src/redis/redis.module';
import { NotificationService } from 'notification/notification.service';
import * as supertest from 'supertest';
import { DataSource } from 'typeorm';
import { addGlobalsToApp } from '../../src/app-globals';
import { LoginModule } from '../../src/login/login.module';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testDb';
import { QueueSSEService } from '../../src/queue/queue-sse.service';

export interface SupertestOptions {
  userId?: number;
}
export type ModuleModifier = (t: TestingModuleBuilder) => TestingModuleBuilder;

export function setupIntegrationTest(
  module: Type<any>,
  modifyModule?: ModuleModifier,
): (u?: SupertestOptions) => supertest.SuperTest<supertest.Test> {
  let app: INestApplication;
  let jwtService: JwtService;
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
    });

    if (modifyModule) {
      testModuleBuilder = modifyModule(testModuleBuilder);
    }
    const testModule = await testModuleBuilder.compile();

    app = testModule.createNestApplication();
    addGlobalsToApp(app);
    jwtService = testModule.get<JwtService>(JwtService);
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
  });

  return (options?: SupertestOptions): supertest.SuperTest<supertest.Test> => {
    const agent = supertest.agent(app.getHttpServer());
    if (options?.userId) {
      const token = jwtService.sign({
        userId: options.userId,
        token_type: 'auth',
      });
      agent.set('Cookie', [`auth_token=${token}`]);
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
