-- mtt-monitor-tracker D1 스키마 (경쟁학원 온디맨드 조회, Phase 1)

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  region TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | running | done | error
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_keyword_created
  ON jobs(user_id, keyword, created_at);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  article_url TEXT,
  cafe_name TEXT,
  write_date TEXT,
  title TEXT,
  summary TEXT,
  sentiment TEXT,
  region TEXT,
  advantages TEXT,             -- JSON array
  disadvantages TEXT,          -- JSON array
  advantage_quotes TEXT,       -- JSON object
  disadvantage_quotes TEXT,    -- JSON object
  mentioned_academies TEXT,    -- JSON array
  academy_evaluations TEXT,    -- JSON object
  ai_model TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_results_job_id ON results(job_id);
