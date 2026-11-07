import * as path from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

export const TestTypeOrmModule = TypeOrmModule.forRoot({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '',
  database: 'test',
  entities: [path.join(__dirname, '../../src/**/*.entity.ts')],
  synchronize: false, // you already call synchronize(true) in beforeEach
  retryAttempts: 0, // fail fast instead of retrying after Jest tears down
});

export const TestConfigModule = ConfigModule.forRoot({
  envFilePath: [path.join(__dirname, '../../.env.test')],
  isGlobal: true,
});
