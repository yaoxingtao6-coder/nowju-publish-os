import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

export type PublishStatus =
  | 'draft'
  | 'queued'
  | 'processing'
  | 'awaiting_confirmation'
  | 'published'
  | 'failed';

export type PublishJob = {
  id: string;
  platform: string;
  title: string | null;
  status: PublishStatus;
  createdAt: string;
  updatedAt: string;
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
        status TEXT NOT NULL,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS last_error TEXT`);
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.redis.quit();
    await this.pool.end();
  }

  async list(): Promise<PublishJob[]> {
    const { rows } = await this.pool.query(
      `SELECT id, platform, title, status, created_at, updated_at
       FROM publish_jobs
       ORDER BY created_at DESC`,
    );
    return rows.map(this.mapRow);
  }

  async get(id: string): Promise<PublishJob | null> {
    const { rows } = await this.pool.query(
      `SELECT id, platform, title, status, created_at, updated_at
       FROM publish_jobs
       WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(input: { platform?: string; title?: string }): Promise<PublishJob> {
    const id = `job_${randomUUID()}`;
    const platform = input.platform ?? 'unknown';
    const title = input.title ?? null;

    const { rows } = await this.pool.query(
      `INSERT INTO publish_jobs (id, platform, title, status)
       VALUES ($1, $2, $3, 'queued')
       RETURNING id, platform, title, status, created_at, updated_at`,
      [id, platform, title],
    );

    await this.queue.add(
      'publish',
      { publishJobId: id, platform },
      {
        jobId: id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    return this.mapRow(rows[0]);
  }

  async setStatus(id: string, status: PublishStatus, lastError: string | null = null) {
    await this.pool.query(
      `UPDATE publish_jobs
       SET status = $2, last_error = $3, updated_at = NOW()
       WHERE id = $1`,
      [id, status, lastError],
    );
  }

  private mapRow(row: any): PublishJob {
    return {
      id: row.id,
      platform: row.platform,
      title: row.title,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
