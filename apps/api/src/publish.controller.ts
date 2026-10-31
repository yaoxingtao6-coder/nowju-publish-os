import { Body, Controller, Get, Param, Post } from '@nestjs/common';

type PublishStatus = 'draft' | 'queued' | 'processing' | 'awaiting_confirmation' | 'published' | 'failed';

type PublishJob = {
  id: string;
  platform: string;
  title?: string;
  status: PublishStatus;
  createdAt: string;
};

const jobs = new Map<string, PublishJob>();

@Controller('publish-jobs')
export class PublishController {
  @Get()
  list() {
    return Array.from(jobs.values());
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return jobs.get(id) ?? { error: 'NOT_FOUND' };
  }

  @Post()
  create(@Body() body: { platform?: string; title?: string }) {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: PublishJob = {
      id,
      platform: body.platform ?? 'unknown',
      title: body.title,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    jobs.set(id, job);
    return job;
  }
}
