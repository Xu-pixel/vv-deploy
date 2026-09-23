import { Database } from "bun:sqlite";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "bun:test";
import { getDb } from "./index";
import { applyMigrations } from "./migrate";
import { finishDeploy, getDeploy, insertDeploy, listDeploys } from "./deploys";

const root = mkdtempSync(join(tmpdir(), "vv-deploys-"));
cpSync(join(process.cwd(), "db"), join(root, "db"), { recursive: true });
const previous = process.env.VV_ROOT;
process.env.VV_ROOT = root;

afterAll(() => {
  if (previous === undefined) delete process.env.VV_ROOT;
  else process.env.VV_ROOT = previous;
  rmSync(root, { recursive: true, force: true });
});

test("migration stores deploy metadata without a log body column", () => {
  const db = new Database(":memory:", { strict: true });
  db.run("PRAGMA foreign_keys = ON;");
  applyMigrations(db);
  const names = db
    .query<{ name: string }, []>("PRAGMA table_info(deploy_logs)")
    .all()
    .map((col) => col.name);
  expect(names).toEqual(["id", "project_id", "started_at", "finished_at", "status"]);
});

test("records each deploy and keeps the log body out of the row", () => {
  const projectId = "ProjectId1";
  getDb()
    .query(
      `INSERT INTO projects (id, name, slug, git_url, branch, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(projectId, "demo", "demo", "git@example:demo.git", "main", "idle", "t", "t");
  const first = insertDeploy(projectId);
  const second = insertDeploy(projectId);
  finishDeploy(first.id, "success");
  const rows = listDeploys(projectId);
  expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
  expect(rows[0]?.status).toBe("running");
  expect(getDeploy(projectId, first.id)?.status).toBe("success");
  expect(getDeploy(projectId, first.id)?.finished_at).toBeTruthy();
  expect(getDeploy("OtherProj1", first.id)).toBeNull();
});
