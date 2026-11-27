// Sentry must be initialized before any other module (express, pg, http, nest)
// is loaded so its OpenTelemetry instrumentation can patch them.
// Keep this as the first import in main.ts.
import { config } from 'dotenv';
import { getEnv } from '@koh/common';
import * as Sentry from '@sentry/nestjs';

// Load .env now, since ConfigModule hasn't run yet at this point.
config({ quiet: true });

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_APM_DSN,
    tracesSampleRate: 0.2,
    // Service Version is the git hash, added by Webpack at build time.
    release: process.env.SERVICE_VERSION,
    environment: getEnv(),
  });
}
