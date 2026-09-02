CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  password TEXT,
  name TEXT,
  academy TEXT,
  status TEXT,
  role TEXT,
  monthly_credit INTEGER,
  remaining_credit INTEGER,
  credit_reset_month TEXT
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT,
  type TEXT,
  mood TEXT,
  topic TEXT,
  keywords TEXT,
  tags TEXT,
  title TEXT,
  body TEXT,
  structure TEXT,
  target_length TEXT,
  section_guide TEXT,
  prompt_version TEXT,
  user_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_user ON blog_posts(user_id);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT,
  thread_id TEXT,
  created_at TEXT,
  author_id TEXT,
  author_name TEXT,
  author_role TEXT,
  owner_id TEXT,
  owner_name TEXT,
  owner_academy TEXT,
  content TEXT
);
CREATE INDEX IF NOT EXISTS idx_feedback_thread ON feedback(thread_id);
CREATE INDEX IF NOT EXISTS idx_feedback_owner ON feedback(owner_id);

CREATE TABLE IF NOT EXISTS credit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT,
  user_id TEXT,
  type TEXT,
  item TEXT,
  delta INTEGER,
  remaining INTEGER
);
CREATE INDEX IF NOT EXISTS idx_credit_log_user ON credit_log(user_id);

CREATE TABLE IF NOT EXISTS school_share (
  user_id TEXT PRIMARY KEY,
  updated_at TEXT,
  data TEXT
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT,
  model TEXT
);

CREATE TABLE IF NOT EXISTS config_models (
  provider TEXT,
  model TEXT,
  ord INTEGER
);

CREATE TABLE IF NOT EXISTS config_credit_costs (
  action_key TEXT PRIMARY KEY,
  cost INTEGER
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  title TEXT,
  body TEXT,
  created_at TEXT
);

-- AI 생성 요청 순차 처리용 락(2026-09) — 여러 사용자가 동시에 생성 버튼을 눌러도
-- Vercel 릴레이/AI API로는 한 번에 하나씩만 나가도록 직렬화한다. 행 1개만 사용.
CREATE TABLE IF NOT EXISTS gen_lock (
  id INTEGER PRIMARY KEY,
  holder TEXT,
  acquired_at INTEGER
);
INSERT OR IGNORE INTO gen_lock (id, holder, acquired_at) VALUES (1, NULL, NULL);
