import { getDb, nowIso } from "./index";
import { newRowId } from "../id";
import type { DeployRun, DeployRunStatus } from "./types";

const COLS = "id, project_id, started_at, finished_at, status";

export function insertDeploy(projectId: string): DeployRun {
  const row: DeployRun = {
    id: newRowId(),
    project_id: projectId,
    started_at: nowIso(),
    finished_at: null,
    status: "running",
  };
  getDb()
    .query(
      `INSERT INTO deploy_logs (id, project_id, started_at, finished_at, status)
       VALUES ($id, $project_id, $started_at, $finished_at, $status)`,
    )
    .run(row);
  return row;
}

export function finishDeploy(id: string, status: Exclude<DeployRunStatus, "running">): void {
  getDb()
    .query(
      `UPDATE deploy_logs SET status = $status, finished_at = $finished_at WHERE id = $id`,
    )
    .run({ id, status, finished_at: nowIso() });
}

export function listDeploys(projectId: string, limit = 40): DeployRun[] {
  return getDb()
    .query<DeployRun, [string, number]>(
      `SELECT ${COLS} FROM deploy_logs
       WHERE project_id = ?
       ORDER BY started_at DESC
       LIMIT ?`,
    )
    .all(projectId, limit);
}

export function getDeploy(projectId: string, id: string): DeployRun | null {
  return (
    getDb()
      .query<DeployRun, [string, string]>(
        `SELECT ${COLS} FROM deploy_logs WHERE project_id = ? AND id = ?`,
      )
      .get(projectId, id) ?? null
  );
}

export function listRunningDeploys(): DeployRun[] {
  return getDb()
    .query<DeployRun, []>(
      `SELECT ${COLS} FROM deploy_logs WHERE status = 'running' ORDER BY started_at ASC`,
    )
    .all();
}
