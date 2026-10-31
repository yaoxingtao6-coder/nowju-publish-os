CREATE TABLE IF NOT EXISTS publish_jobs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_created_at
  ON publish_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_status
  ON publish_jobs (status);
