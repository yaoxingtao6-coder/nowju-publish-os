import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PublishService } from './publish.service';

@Controller('publish-jobs')
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Get()
  list() {
    return this.publishService.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.publishService.requireJob(id);
  }

  @Get(':id/logs')
  logs(@Param('id') id: string) {
    return this.publishService.logs(id);
  }

  @Post()
  create(
    @Body()
    body: {
      platform?: string;
      title?: string;
      content?: string;
      accountId?: string;
      scheduledFor?: string;
      draft?: boolean;
    },
  ) {
    return this.publishService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      content?: string;
      accountId?: string;
      scheduledFor?: string | null;
    },
  ) {
    return this.publishService.update(id, body);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.publishService.cancel(id);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.publishService.retry(id);
  }
}
