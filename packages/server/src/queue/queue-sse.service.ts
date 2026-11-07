import { Role, SSEQueueResponse } from '@koh/common';
import { Injectable, ConsoleLogger, OnModuleDestroy } from '@nestjs/common';
import { Response } from 'express';
import { throttle } from 'lodash';
import { SSEService } from 'sse/sse.service';
import { QueueService } from './queue.service';

type QueueClientMetadata = { userId: number; role: Role };
type Throttled = ReturnType<typeof throttle>;

const idToRoom = (queueId: number) => `q-${queueId}`;
/**
 * Handle sending queue sse events
 */
@Injectable()
export class QueueSSEService implements OnModuleDestroy {
  private readonly logger = new ConsoleLogger(QueueSSEService.name);

  // Declared before updateQuestions/updateQueue: class fields initialize in order,
  // and throttleUpdate() uses these.
  private readonly throttlerMaps: Map<number, Throttled>[] = [];
  private destroyed = false;

  constructor(
    private queueService: QueueService,
    private sseService: SSEService<QueueClientMetadata>,
  ) {}

  subscribeClient(
    queueId: number,
    res: Response,
    metadata: QueueClientMetadata,
  ): void {
    this.sseService.subscribeClient(idToRoom(queueId), res, metadata);
  }

  // Send event with new questions, but no more than once a second per queue
  updateQuestions = this.throttleUpdate(async (queueId) => {
    const questions = await this.queueService.getQuestions(queueId);
    if (questions) {
      await this.sendToRoom(queueId, async ({ role, userId }) => ({
        questions: await this.queueService.personalizeQuestions(
          queueId,
          questions,
          userId,
          role,
        ),
      }));
    }
  });

  updateQueue = this.throttleUpdate(async (queueId) => {
    const queue = await this.queueService.getQueue(queueId);
    if (queue) {
      await this.sendToRoom(queueId, async () => ({ queue }));
    }
  });

  // Called by Nest on app.close() (and on normal shutdown): stop pending
  // updates so they don't query a closed database connection.
  onModuleDestroy(): void {
    this.destroyed = true;
    for (const throttlers of this.throttlerMaps) {
      for (const throttled of throttlers.values()) {
        throttled.cancel();
      }
      throttlers.clear();
    }
  }
  /**
   * Runs any pending throttled updates now and waits for them to finish.
   * Used by integration tests before resetting the database.
   */
  async flushPendingUpdates(): Promise<void> {
    const results: unknown[] = [];
    for (const throttlers of this.throttlerMaps) {
      for (const throttled of throttlers.values()) {
        results.push(throttled.flush());
      }
    }
    await Promise.all(results);
  }

  private async sendToRoom(
    queueId: number,
    data: (metadata: QueueClientMetadata) => Promise<SSEQueueResponse>,
  ) {
    await this.sseService.sendEvent(idToRoom(queueId), data);
  }

  /**
   * Returns a function that runs updateFunction for a queue at most once a
   * second. Each queue gets its own throttle, so updates to one queue never
   * drop updates to another.
   */
  private throttleUpdate(
    updateFunction: (queueId: number) => Promise<void>,
  ): (queueId: number) => void {
    const throttlers = new Map<number, Throttled>();
    this.throttlerMaps.push(throttlers);

    return (queueId: number): void => {
      if (this.destroyed) return;

      let throttled = throttlers.get(queueId);
      if (!throttled) {
        throttled = throttle(
          async () => {
            // A trailing call can still be in flight when shutdown starts
            if (this.destroyed) return;
            try {
              await updateFunction(queueId);
            } catch (e) {
              this.logger.error(e);
            }
          },
          1000,
          {
            leading: false,
            trailing: true,
          },
        );
        throttlers.set(queueId, throttled);
      }
      throttled();
    };
  }
}
