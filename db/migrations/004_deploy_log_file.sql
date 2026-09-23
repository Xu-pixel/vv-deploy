-- Log bodies live in data/deploy-logs/<project id>/<deploy id>.log, not in this table.
CREATE TABLE deploy_logs_new (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

INSERT INTO deploy_logs_new (id, project_id, started_at, finished_at, status)
SELECT id, project_id, started_at, finished_at, status FROM deploy_logs;

DROP TABLE deploy_logs;
ALTER TABLE deploy_logs_new RENAME TO deploy_logs;

CREATE INDEX IF NOT EXISTS idx_deploy_logs_project ON deploy_logs(project_id, started_at);
