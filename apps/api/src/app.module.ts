import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { ConfirmationController } from './confirmation.controller';
import { ConfirmationService } from './confirmation.service';
import { DatabaseBootstrapService } from './database-bootstrap.service';
import { HealthController } from './health.controller';
import { PlatformAdapterService } from './platform-adapter.service';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';
import { PublishWorkerService } from './publish-worker.service';

@Module({
  imports: [],
  controllers: [
    HealthController,
    PublishController,
    AccountController,
    AssetController,
    ConfirmationController,
  ],
  providers: [
    DatabaseBootstrapService,
    PublishService,
    PlatformAdapterService,
    PublishWorkerService,
    AccountService,
    AssetService,
    ConfirmationService,
  ],
})
export class AppModule {}
