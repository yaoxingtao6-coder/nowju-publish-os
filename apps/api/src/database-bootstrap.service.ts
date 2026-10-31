import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseBootstrapService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
      );

      ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS content TEXT;
      ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS account_id TEXT;
      ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
      ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS last_error TEXT;

      CREATE INDEX IF NOT EXISTS idx_publish_jobs_created_at ON publish_jobs (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_publish_jobs_status ON publish_jobs (status);
      CREATE INDEX IF NOT EXISTS idx_publish_jobs_scheduled_for ON publish_jobs (scheduled_for);

      CREATE TABLE IF NOT EXISTS publish_logs (
        id BIGSERIAL PRIMARY KEY,
        publish_job_id TEXT NOT NULL REFERENCES publish_jobs(id) ON DELETE CASCADE,
        level TEXT NOT NULL DEFAULT 'info',
        event TEXT NOT NULL,
        message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_publish_logs_job_id ON publish_logs (publish_job_id, id);

      CREATE TABLE IF NOT EXISTS platform_accounts (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        display_name TEXT NOT NULL,
        auth_status TEXT NOT NULL DEFAULT 'disconnected',
        auth_mode TEXT NOT NULL DEFAULT 'human_confirmation',
        external_account_id TEXT,
        expires_at TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON platform_accounts (platform);
      CREATE INDEX IF NOT EXISTS idx_platform_accounts_auth_status ON platform_accounts (auth_status);

      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT,
        storage_url TEXT NOT NULL,
        size_bytes BIGINT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets (created_at DESC);

      CREATE TABLE IF NOT EXISTS publish_confirmations (
        id TEXT PRIMARY KEY,
        publish_job_id TEXT NOT NULL REFERENCES publish_jobs(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        note TEXT,
        confirmed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(publish_job_id)
      );

      CREATE INDEX IF NOT EXISTS idx_publish_confirmations_status ON publish_confirmations (status, created_at);
    `);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
