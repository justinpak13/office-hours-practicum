import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';

export type RedisClientName = 'pub' | 'sub' | 'db';

const RELEASE_LOCK =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

@Injectable()
export class RedisService implements OnModuleDestroy {
  // lazyConnect: sockets open on first command, so constructing the service (e.g. in unit tests) opens no connections
  private readonly clients: Record<RedisClientName, Redis> = {
    pub: new Redis({ lazyConnect: true }),
    sub: new Redis({ lazyConnect: true }),
    db: new Redis({ lazyConnect: true }),
  };

  getClient(name: RedisClientName): Redis {
    return this.clients[name];
  }

  // Single-node mutex so a cron job runs once across pm2 cluster instances. Returns false if another instance holds the lock.
  async withLock(
    key: string,
    ttlMs: number,
    work: () => Promise<void>,
  ): Promise<boolean> {
    const db = this.clients.db;
    const token = randomBytes(16).toString('hex');
    const acquired = await db.set(key, token, 'PX', ttlMs, 'NX');
    if (acquired !== 'OK') return false;
    try {
      await work();
    } finally {
      // A failed release must not mask a work() error; the lock still expires at its TTL
      await db
        .eval(RELEASE_LOCK, 1, key, token)
        .catch((err) => console.error('Error releasing lock:', key, err));
    }
    return true;
  }

  onModuleDestroy(): void {
    Object.values(this.clients).forEach((c) => c.disconnect());
  }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
