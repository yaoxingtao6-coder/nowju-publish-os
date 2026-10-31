import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PublishController } from './publish.controller';

@Module({
  imports: [],
  controllers: [HealthController, PublishController],
  providers: [],
})
export class AppModule {}
