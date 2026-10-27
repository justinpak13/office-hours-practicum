import Redis from 'ioredis';
import * as session from 'express-session';
import * as connectRedis from 'connect-redis';

const secret = process.env.ADMIN_SESSION_SECRET;
if (!secret && process.env.NODE_ENV !== 'test') {
  throw new Error('ADMIN_SESSION_SECRET must be set');
}

const redisClient = new Redis({
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: process.env.NODE_ENV === 'test',
});
redisClient.on('error', (err) =>
  console.error('Admin session Redis error:', err),
);

const RedisStore = connectRedis(session);

export const adminSession = session({
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

// Lets TypeScript know about the field we store on the session
declare module 'express-session' {
  interface SessionData {
    adminUserId?: number;
  }
}
