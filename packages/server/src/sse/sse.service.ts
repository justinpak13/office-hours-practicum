import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { each } from 'async';
import { serialize } from 'class-transformer';
import { Response } from 'express';
import { RedisService } from 'nestjs-redis';
import { ERROR_MESSAGES } from '@koh/common';
import * as Sentry from '@sentry/node';

/**
 * A connection to a particular frontend client
 */
interface Connection {
  res: Response;
  cleanup: () => Promise<void>;
}

interface RedisClientInfo<T> {
  clientId: number;
  metadata: T;
}
/**
 * T is metadata associated with each Client
 *
 * Low level abstraction for sending SSE to "rooms" of clients.
 * Probably don't use this directly, and wrap it in a service specific to that event source
 *
 * This handles when there's multiple backend instances by assigning unique client ids to each connection.
 * When one instance wants to send to a client, it publishes to a Redis channel for the client.
 * All instances listen to Redis, and if they are the one managing that client, they send the msg.
 *
 * Rooms with client metadata are also maintained in Redis key/value store.
 */
@Injectable()
export class SSEService<T> implements OnModuleDestroy {
  // Clients connected to this instance of the backend
  private directConnnections: Record<string, Connection> = {};

  constructor(private readonly redisService: RedisService) {
    const redisSub = this.redisService.getClient('sub');

    if (!redisSub) {
      Sentry.captureException(ERROR_MESSAGES.sseService.getSubClient);
      throw new Error(ERROR_MESSAGES.sseService.getSubClient);
    }

    // If channel is managed by this instance, send the message to the Response object.
    redisSub.on('message', (channel, message) => {
      const id = /sse::client-(\d+)/.exec(channel);
      if (id && id[1] in this.directConnnections) {
        this.directConnnections[id[1]].res.write(`data: ${message}\n\n`);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    // Cleanup all direct connections by removing them from the rooms in redis.
    await each(Object.values(this.directConnnections), async (conn) => {
      await conn.cleanup().catch((err) => {
        console.error(ERROR_MESSAGES.sseService.cleanupConnection);
        console.error(err);
        Sentry.captureException(err);
      });
    }).catch((err) => {
      console.error(ERROR_MESSAGES.sseService.moduleDestroy);
      console.error(err);
      Sentry.captureException(err);
    });
  }

  /**
   * Get redis channel name from client id
   */
  private idToChannel(clientId: number) {
    return `sse::client-${clientId}`;
  }

  /** Add a client to a room */
  async subscribeClient(
    room: string,
    res: Response,
    metadata: T,
  ): Promise<void> {
    const redisSub = this.redisService.getClient('sub');
    const redis = this.redisService.getClient('db');

    if (!redisSub) {
      Sentry.captureException(ERROR_MESSAGES.sseService.getSubClient);
      throw new Error(ERROR_MESSAGES.sseService.getSubClient);
    }
    if (!redis) {
      Sentry.captureException(ERROR_MESSAGES.sseService.getDBClient);
      throw new Error(ERROR_MESSAGES.sseService.getDBClient);
    }

    // Keep track of responses so we can send sse through them
    const clientId = await redis.incr('sse::client::id').catch((err) => {
      console.error(ERROR_MESSAGES.sseService.clientIdSubscribe);
      console.error(err);
      Sentry.captureException(err);
    });
    // Subscribe to the redis channel for this client

    if (!clientId) {
      Sentry.captureException(ERROR_MESSAGES.sseService.clientIdNotFound);
      throw new Error(ERROR_MESSAGES.sseService.clientIdNotFound);
    }

    await redisSub.subscribe(this.idToChannel(clientId)).catch((err) => {
      console.error(ERROR_MESSAGES.sseService.subscribe);
      console.error(err);
      Sentry.captureException(err);
    });

    // Add to room
    const clientInfo = JSON.stringify({
      clientId,
      metadata: metadata,
    } as RedisClientInfo<T>);
    await redis.sadd(room, clientInfo).catch((err) => {
      console.error(err);
      Sentry.captureException(err);
    });

    // Heartbeat: keeps proxies (nginx) from reaping idle streams during quiet
    // queues, and makes a dead socket surface a 'close' event promptly.
    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 30000);

    // Keep track of response object in direct connections
    this.directConnnections[clientId] = {
      res,
      cleanup: async () => {
        clearInterval(heartbeat);
        // Remove from the redis room
        await redis.srem(room, clientInfo).catch((err) => {
          console.error(ERROR_MESSAGES.sseService.removeFromRoom);
          console.error(err);
        });
        await redisSub.unsubscribe(this.idToChannel(clientId)).catch((err) => {
          console.error(ERROR_MESSAGES.sseService.unsubscribe);
          console.error(err);
          Sentry.captureException(err);
        });
        res.end();
      },
    };

    // Ack so frontend knows we're connected
    res.write('\n');

    // Remove dead connections. 'end' fires on a graceful close; 'close' fires
    // on abrupt drops (laptop sleep, wifi loss, RST) that never emit 'end'.
    // Delete before cleanup so if both fire we only clean up once.
    const onDisconnect = async () => {
      const connection = this.directConnnections[clientId];
      if (!connection) {
        return;
      }
      delete this.directConnnections[clientId];
      await connection.cleanup().catch((err) => {
        console.error(ERROR_MESSAGES.sseService.directConnections);
        console.error(err);
        Sentry.captureException(err);
      });
    };
    res.socket.on('end', onDisconnect);
    res.socket.on('close', onDisconnect);
  }

  /** Send some data to everyone in a room */
  async sendEvent<D>(
    room: string,
    payload: (metadata: T) => Promise<D>,
  ): Promise<void> {
    const redisPub = this.redisService.getClient('pub');
    const redis = this.redisService.getClient('db');

    if (!redisPub) {
      Sentry.captureException(ERROR_MESSAGES.sseService.getPubClient);
      throw new Error(ERROR_MESSAGES.sseService.getPubClient);
    }

    if (!redis) {
      Sentry.captureException(ERROR_MESSAGES.sseService.getDBClient);
      throw new Error(ERROR_MESSAGES.sseService.getDBClient);
    }

    const roomInfo = await redis.smembers(room).catch((err) => {
      console.error(ERROR_MESSAGES.sseService.roomMembers);
      console.error(err);
      Sentry.captureException(err);
    });
    if (room && roomInfo) {
      console.log(`sending sse to ${roomInfo.length} clients in ${room}`);
      console.time(`sending sse time: `);
      await each(roomInfo, async (clientInfoStr) => {
        const { clientId, metadata }: RedisClientInfo<T> =
          JSON.parse(clientInfoStr);
        const payloadData = await payload(metadata).catch((err) => {
          console.error(ERROR_MESSAGES.sseService.serialize);
          console.error(err);
          Sentry.captureException(err);
        });
        // Don't publish a malformed "undefined" frame when payload gen failed
        if (payloadData === undefined) {
          return;
        }
        const toSend = serialize(payloadData);
        const receivers = await redisPub
          .publish(this.idToChannel(clientId), toSend)
          .catch((err) => {
            console.error(ERROR_MESSAGES.sseService.publish);
            console.error(err);
            Sentry.captureException(err);
          });
        // No subscriber received the message -> the client is gone (e.g. its
        // instance crashed, or it dropped without emitting 'close'). Prune the
        // stale room member so the set can't grow unbounded.
        if (receivers === 0) {
          await redis.srem(room, clientInfoStr).catch((err) => {
            console.error(ERROR_MESSAGES.sseService.removeFromRoom);
            console.error(err);
          });
        }
      });
      console.timeEnd(`sending sse time: `);
    }
  }
}
