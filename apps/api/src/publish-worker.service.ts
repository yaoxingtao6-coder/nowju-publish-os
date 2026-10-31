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

        await this.publishService.setStatus(publishJobId, 'processing');

        try {
          const result = await this.adapters.prepare(platform);
          await this.publishService.setStatus(publishJobId, result.status);
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
          await this.publishService.setStatus(publishJobId, 'failed', message);
          throw error;
        }
      },
      { connection: this.redis },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.redis.quit();
  }
}
