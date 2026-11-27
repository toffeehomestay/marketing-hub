-- New Cloudflare D1 database; do not apply to the Supabase database.
CREATE TABLE workspaces (
  github_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
