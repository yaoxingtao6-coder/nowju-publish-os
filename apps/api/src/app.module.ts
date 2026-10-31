import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PlatformAdapterService } from './platform-adapter.service';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';
import { PublishWorkerService } from './publish-worker.service';

@Module({
  imports: [],
  controllers: [HealthController, PublishController],
  providers: [PublishService, PlatformAdapterService, PublishWorkerService],
})
export class AppModule {}
