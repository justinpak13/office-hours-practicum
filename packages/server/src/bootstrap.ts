import { isProd } from '@koh/common';
import { NestFactory } from '@nestjs/core';
import * as morgan from 'morgan';
import { AppModule } from './app.module';
import { addGlobalsToApp } from './app-globals';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function bootstrap(hot: any): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  app.enableShutdownHooks(); // So we can clean up SSE.

  if (isProd()) {
    console.log(`Running production at ${process.env.DOMAIN}.`);
  } else {
    console.log(
      `Running non-production at ${process.env.DOMAIN}. THIS MSG SHOULD NOT APPEAR ON PROD VM`,
    );
  }

  addGlobalsToApp(app);
  app.setGlobalPrefix('api/v1');
  app.use(morgan('dev'));
  await app.listen(3002);

  if (hot) {
    hot.accept();
    hot.dispose(() => app.close());
  }
}
