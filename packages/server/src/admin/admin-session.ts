import type { Redis } from 'ioredis';
import * as session from 'express-session';
import { RedisStore } from 'connect-redis';

// Built when the admin module is configured, after ConfigModule has loaded
// .env and .env.development. Reading the secret at import time ran before
// that, so `yarn dev` crashed even with the secret in .env.development.
// The Redis client comes from RedisService, which disconnects it when the app
// shuts down, so a hot reload in `yarn dev` doesn't leave a connection open.
export function createAdminSession(redisClient: Redis) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret && process.env.NODE_ENV !== 'test') {
    throw new Error('ADMIN_SESSION_SECRET must be set');
  }

  return session({
    store: new RedisStore({ client: redisClient }),
    // express-session throws at startup if this is undefined, which is what you
    // want: no silent fallback to a guessable secret
    secret: secret ?? 'test-only-secret',
    name: 'admin.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    },
  });
}

// Lets TypeScript know about the field we store on the session
declare module 'express-session' {
  interface SessionData {
    adminUserId?: number;
  }
}
