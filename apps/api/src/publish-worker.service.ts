import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PlatformAdapterService } from './platform-adapter.service';
import { PublishService } from './publish.service';

@Injectable()
export class PublishWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  private worker?: Worker;

  constructor(
    private readonly publishService: PublishService,
    private readonly adapters: PlatformAdapterService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      'publish-jobs',
      async (job) => {
        const { publishJobId, platform } = job.data as {
          publishJobId: string;
          platform: string;
        };

        const current = await this.publishService.requireJob(publishJobId);
        if (current.status === 'cancelled' || current.status === 'published') {
          await this.publishService.log(
            publishJobId,
            'skipped',
            `Worker skipped task in terminal state: ${current.status}`,
          );
          return { skipped: true, status: current.status };
        }

        await this.publishService.setStatus(publishJobId, 'processing');
        await this.publishService.log(
          publishJobId,
          'processing',
          `Attempt ${job.attemptsMade + 1} started`,
        );

        try {
          const result = await this.adapters.prepare(platform);
          await this.publishService.setStatus(publishJobId, result.status);
          await this.publishService.log(
            publishJobId,
            result.status,
            `${result.mode}: ${result.message}`,
          );
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
          const maxAttempts = Number(job.opts.attempts ?? 1);
          const willRetry = job.attemptsMade + 1 < maxAttempts;
          await this.publishService.setStatus(
            publishJobId,
            willRetry ? 'retrying' : message.startsWith('AUTH_REQUIRED:') ? 'needs_auth' : 'failed',
            message,
          );
          await this.publishService.log(
            publishJobId,
            willRetry ? 'retrying' : 'failed',
            message,
            'error',
          );
          throw error;
        }
      },
      {
        connection: this.redis,
        concurrency: Number(process.env.PUBLISH_WORKER_CONCURRENCY ?? 3),
      },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.redis.quit();
  }
}
