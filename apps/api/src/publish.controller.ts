import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
    return (await this.publishService.get(id)) ?? { error: 'NOT_FOUND' };
  }

  @Post()
  create(@Body() body: { platform?: string; title?: string }) {
    return this.publishService.create(body);
  }
}
