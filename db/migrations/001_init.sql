CREATE TABLE IF NOT EXISTS git_credentials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  public_key TEXT NOT NULL,
  private_key_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  git_url TEXT NOT NULL,
  branch TEXT NOT NULL,
  credential_id TEXT,
  status TEXT NOT NULL,
  last_commit_sha TEXT,
  last_commit_message TEXT,
  last_commit_author TEXT,
  last_commit_at TEXT,
  expose_service TEXT,
  expose_port INTEGER,
  last_deployed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (credential_id) REFERENCES git_credentials(id)
);

CREATE TABLE IF NOT EXISTS deploy_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  log_text TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_deploy_logs_project ON deploy_logs(project_id, started_at);
