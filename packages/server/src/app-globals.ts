import { INestApplication, ValidationPipe } from '@nestjs/common';
import { StripUndefinedPipe } from './stripUndefined.pipe';

// Global settings that should be true in prod and in integration tests
export function addGlobalsToApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalPipes(new StripUndefinedPipe());
}
