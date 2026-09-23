import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import { spillLegacyDeployLogs } from "../deploy-log";
import { projectRoot } from "../paths";

type MigrationRow = { id: string };

export function applyMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const dir = join(projectRoot(), "db", "migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const applied = new Set(
    db.query<MigrationRow, []>("SELECT id FROM _migrations").all().map((row) => row.id),
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    const apply = db.transaction(() => {
      if (file === "004_deploy_log_file.sql") spillLegacyDeployLogs(db);
      db.run(sql);
      db.query("INSERT INTO _migrations (id, applied_at) VALUES ($id, $at)").run({
        id: file,
        at: new Date().toISOString(),
      });
    });
    apply();
  }
}
