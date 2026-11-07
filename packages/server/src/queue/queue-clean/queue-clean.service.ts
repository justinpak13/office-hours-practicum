import {
  ClosedQuestionStatus,
  LimboQuestionStatus,
  OpenQuestionStatus,
} from '@koh/common';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import async from 'async';
import { RedisService } from 'nestjs-redis';
import * as Redlock from 'redlock';
import { EventModel, EventType } from 'profile/event-model.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { Connection } from 'typeorm';
import { QuestionModel } from '../../question/question.entity';
import { QueueModel } from '../queue.entity';
import { AlertModel } from '../../alerts/alerts.entity';

/**
 * Clean the queue and mark stale
 */
@Injectable()
export class QueueCleanService {
  constructor(
    private connection: Connection,
    private readonly redisService: RedisService,
  ) {}

  // Runs `work` behind a Redlock so the nightly jobs fire once even though
  // pm2 runs multiple cluster instances that each schedule these crons.
  private async withClusterLock(
    resource: string,
    work: () => Promise<void>,
  ): Promise<void> {
    const ttl = 120000;
    const redisDB = await this.redisService.getClient('db');
    const redlock = new Redlock([redisDB]);
    redlock.on('clientError', (err) =>
      console.error('A redis error has occurred:', err),
    );
    try {
      await redlock.lock(resource, ttl).then(async (lock) => {
        await work();
        return lock
          .unlock()
          .catch((err) => console.error('Error unlocking Redlock:', err));
      });
    } catch (error) {
      // Losing the lock race is expected on the other instance(s)
      console.error('A problem locking Redlock has occurred:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanAllQueues(): Promise<void> {
    await this.withClusterLock('locks:cleanAllQueues', async () => {
      const queuesWithOpenQuestions: QueueModel[] =
        await QueueModel.getRepository()
          .createQueryBuilder('queue_model')
          .leftJoinAndSelect('queue_model.questions', 'question')
          .where('question.status IN (:...status)', {
            status: [
              ...Object.values(OpenQuestionStatus),
              ...Object.values(LimboQuestionStatus),
            ],
          })
          .getMany();

      // Clean 1 queue at a time
      await async.mapLimit(
        queuesWithOpenQuestions,
        1,
        async (queue) => await this.cleanQueue(queue.id),
      );
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  public async checkoutAllStaff(): Promise<void> {
    await this.withClusterLock('locks:checkoutAllStaff', async () => {
      const queuesWithCheckedInStaff: QueueModel[] =
        await QueueModel.getRepository().find({ relations: ['staffList'] });

      for (const queue of queuesWithCheckedInStaff) {
        for (const ta of queue.staffList) {
          await EventModel.create({
            time: new Date(),
            eventType: EventType.TA_CHECKED_OUT_FORCED,
            userId: ta.id,
            courseId: queue.courseId,
            queueId: queue.id,
          }).save();
        }
        queue.staffList = [];
      }
      await QueueModel.save(queuesWithCheckedInStaff);
    });
  }

  // TODO: move this to a course-clean service or something. This is just here because
  // this feature was pushed out in a time crunch.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  public async cleanSelfEnrollOverrides(): Promise<void> {
    await this.withClusterLock('locks:cleanSelfEnrollOverrides', async () => {
      await UserCourseModel.delete({
        expires: true,
      });
    });
  }

  public async cleanQueue(queueId: number, force?: boolean): Promise<void> {
    const queue = await QueueModel.findOne(queueId, {
      relations: ['staffList'],
    });

    if (force || !(await queue.checkIsOpen())) {
      await this.unsafeClean(queue.id);
    }
  }

  private async unsafeClean(queueId: number): Promise<void> {
    const questions = await QuestionModel.inQueueWithStatus(queueId, [
      ...Object.values(OpenQuestionStatus),
      ...Object.values(LimboQuestionStatus),
    ]).getMany();
    const alerts = await AlertModel.createQueryBuilder('alert')
      .where('alert.resolved IS NULL')
      .andWhere("(alert.payload ->> 'queueId')::INTEGER = :queueId ", {
        queueId,
      })
      .getMany();

    questions.forEach((q: QuestionModel) => {
      q.status = ClosedQuestionStatus.Stale;
      q.closedAt = new Date();
    });
    alerts.forEach((a: AlertModel) => {
      a.resolved = new Date();
    });

    await QuestionModel.save(questions);
    await AlertModel.save(alerts);
  }
}
