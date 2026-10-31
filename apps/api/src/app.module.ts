import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';

@Module({
  imports: [],
  controllers: [HealthController, PublishController],
  providers: [PublishService],
})
export class AppModule {}
