import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

export type PublishStatus =
  | 'draft'
  | 'scheduled'
  | 'queued'
  | 'processing'
  | 'awaiting_confirmation'
  | 'published'
  | 'failed'
  | 'retrying'
  | 'cancelled'
  | 'needs_auth';

export type PublishJob = {
  id: string;
  platform: string;
  title: string | null;
  content: string | null;
  accountId: string | null;
  status: PublishStatus;
  scheduledFor: string | null;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublishLog = {
  id: number;
  publishJobId: string;
  level: 'info' | 'error';
  event: string;
  message: string | null;
  createdAt: string;
};

@Injectable()
export class PublishService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  private readonly redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  private readonly queue = new Queue('publish-jobs', {
    connection: this.redis,
  });

  async onModuleInit() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS publish_jobs (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        title TEXT,
        content TEXT,
        account_id TEXT,
        status TEXT NOT NULL,
        scheduled_for TIMESTAMPTZ,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS content TEXT`);
    await this.pool.query(`ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS account_id TEXT`);
    await this.pool.query(`ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ`);
    await this.pool.query(`ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0`);
    await this.pool.query(`ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS last_error TEXT`);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS publish_logs (
        id BIGSERIAL PRIMARY KEY,
        publish_job_id TEXT NOT NULL REFERENCES publish_jobs(id) ON DELETE CASCADE,
        level TEXT NOT NULL DEFAULT 'info',
        event TEXT NOT NULL,
        message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.redis.quit();
    await this.pool.end();
  }

  async list(): Promise<PublishJob[]> {
    const { rows } = await this.pool.query(
      `SELECT id, platform, title, content, account_id, status, scheduled_for,
              retry_count, last_error, created_at, updated_at
       FROM publish_jobs
       ORDER BY created_at DESC`,
    );
    return rows.map(this.mapRow);
  }

  async get(id: string): Promise<PublishJob | null> {
    const { rows } = await this.pool.query(
      `SELECT id, platform, title, content, account_id, status, scheduled_for,
              retry_count, last_error, created_at, updated_at
       FROM publish_jobs
       WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async requireJob(id: string): Promise<PublishJob> {
    const job = await this.get(id);
    if (!job) throw new NotFoundException('PUBLISH_JOB_NOT_FOUND');
    return job;
  }

  async create(input: {
    platform?: string;
    title?: string;
    content?: string;
    accountId?: string;
    scheduledFor?: string;
    draft?: boolean;
  }): Promise<PublishJob> {
    const id = `job_${randomUUID()}`;
    const platform = input.platform?.trim() || 'unknown';
    const title = input.title?.trim() || null;
    const content = input.content?.trim() || null;
    const accountId = input.accountId?.trim() || null;
    const scheduledFor = this.parseSchedule(input.scheduledFor);
    const status: PublishStatus = input.draft ? 'draft' : scheduledFor ? 'scheduled' : 'queued';

    const { rows } = await this.pool.query(
      `INSERT INTO publish_jobs
         (id, platform, title, content, account_id, status, scheduled_for)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, platform, title, content, account_id, status, scheduled_for,
                 retry_count, last_error, created_at, updated_at`,
      [id, platform, title, content, accountId, status, scheduledFor],
    );

    await this.log(id, 'created', status === 'scheduled' ? 'Scheduled publish task created' : 'Publish task created');

    if (!input.draft) {
      await this.enqueue(id, platform, scheduledFor);
    }

    return this.mapRow(rows[0]);
  }

  async update(
    id: string,
    input: { title?: string; content?: string; accountId?: string; scheduledFor?: string | null },
  ): Promise<PublishJob> {
    const current = await this.requireJob(id);
    if (['processing', 'published', 'cancelled'].includes(current.status)) {
      throw new BadRequestException(`PUBLISH_JOB_NOT_EDITABLE:${current.status}`);
    }

    const scheduledFor = input.scheduledFor === undefined
      ? current.scheduledFor
      : this.parseSchedule(input.scheduledFor ?? undefined);

    const { rows } = await this.pool.query(
      `UPDATE publish_jobs
       SET title = $2,
           content = $3,
           account_id = $4,
           scheduled_for = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, platform, title, content, account_id, status, scheduled_for,
                 retry_count, last_error, created_at, updated_at`,
      [
        id,
        input.title === undefined ? current.title : input.title?.trim() || null,
        input.content === undefined ? current.content : input.content?.trim() || null,
        input.accountId === undefined ? current.accountId : input.accountId?.trim() || null,
        scheduledFor,
      ],
    );

    await this.log(id, 'updated', 'Publish task updated');
    return this.mapRow(rows[0]);
  }

  async cancel(id: string): Promise<PublishJob> {
    const current = await this.requireJob(id);
    if (current.status === 'published') {
      throw new BadRequestException('PUBLISHED_JOB_CANNOT_BE_CANCELLED');
    }

    const queued = await this.queue.getJob(id);
    if (queued) {
      try {
        await queued.remove();
      } catch {
        // Active jobs cannot be removed. The database state still prevents further user actions.
      }
    }

    await this.setStatus(id, 'cancelled');
    await this.log(id, 'cancelled', 'Publish task cancelled');
    return this.requireJob(id);
  }

  async retry(id: string): Promise<PublishJob> {
    const current = await this.requireJob(id);
    if (!['failed', 'needs_auth'].includes(current.status)) {
      throw new BadRequestException(`PUBLISH_JOB_NOT_RETRYABLE:${current.status}`);
    }

    await this.pool.query(
      `UPDATE publish_jobs
       SET status = 'retrying', retry_count = retry_count + 1, last_error = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id],
    );

    const existing = await this.queue.getJob(id);
    if (existing && (await existing.getState()) === 'failed') {
      await existing.retry();
    } else if (!existing) {
      await this.enqueue(id, current.platform, null);
    }

    await this.log(id, 'retrying', 'Publish task queued for retry');
    return this.requireJob(id);
  }

  async logs(id: string): Promise<PublishLog[]> {
    await this.requireJob(id);
    const { rows } = await this.pool.query(
      `SELECT id, publish_job_id, level, event, message, created_at
       FROM publish_logs
       WHERE publish_job_id = $1
       ORDER BY id ASC`,
      [id],
    );

    return rows.map((row) => ({
      id: Number(row.id),
      publishJobId: row.publish_job_id,
      level: row.level,
      event: row.event,
      message: row.message,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async setStatus(id: string, status: PublishStatus, lastError: string | null = null) {
    await this.pool.query(
      `UPDATE publish_jobs
       SET status = $2, last_error = $3, updated_at = NOW()
       WHERE id = $1`,
      [id, status, lastError],
    );
  }

  async log(
    id: string,
    event: string,
    message: string | null = null,
    level: 'info' | 'error' = 'info',
  ) {
    await this.pool.query(
      `INSERT INTO publish_logs (publish_job_id, level, event, message)
       VALUES ($1, $2, $3, $4)`,
      [id, level, event, message],
    );
  }

  private async enqueue(id: string, platform: string, scheduledFor: string | null) {
    const delay = scheduledFor ? Math.max(0, new Date(scheduledFor).getTime() - Date.now()) : 0;
    await this.queue.add(
      'publish',
      { publishJobId: id, platform },
      {
        jobId: id,
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
    await this.log(id, 'queued', delay > 0 ? `Queued with delay ${delay}ms` : 'Queued for publishing');
  }

  private parseSchedule(value?: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('INVALID_SCHEDULED_FOR');
    return date.toISOString();
  }

  private mapRow(row: any): PublishJob {
    return {
      id: row.id,
      platform: row.platform,
      title: row.title,
      content: row.content,
      accountId: row.account_id,
      status: row.status,
      scheduledFor: row.scheduled_for ? new Date(row.scheduled_for).toISOString() : null,
      retryCount: Number(row.retry_count ?? 0),
      lastError: row.last_error ?? null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
