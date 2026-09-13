import "server-only";

import { getDb, nowIso } from "./index";
import type { Project, ProjectStatus } from "./types";

export function listProjects(q?: string): Project[] {
  if (!q?.trim()) {
    return getDb()
      .query<Project, []>("SELECT * FROM projects ORDER BY updated_at DESC")
      .all();
  }
  const like = `%${q.trim()}%`;
  return getDb()
    .query<Project, [string]>(
      `SELECT * FROM projects
       WHERE name LIKE ?1 OR slug LIKE ?1 OR git_url LIKE ?1 OR branch LIKE ?1 OR custom_domain LIKE ?1
       ORDER BY updated_at DESC`,
    )
    .all(like);
}

export function getProject(id: string): Project | null {
  return getDb().query<Project, [string]>("SELECT * FROM projects WHERE id = ?").get(id);
}

export function getProjectBySlug(slug: string): Project | null {
  return getDb()
    .query<Project, [string]>("SELECT * FROM projects WHERE slug = ?")
    .get(slug);
}

export function getProjectByGitUrl(git_url: string, branch: string): Project | null {
  return getDb()
    .query<Project, [string, string]>(
      "SELECT * FROM projects WHERE git_url = ? AND branch = ?",
    )
    .get(git_url, branch);
}

export function insertProject(row: Omit<Project, "created_at" | "updated_at">): Project {
  const created_at = nowIso();
  const updated_at = created_at;
  getDb()
    .query(
      `INSERT INTO projects (
        id, name, slug, git_url, branch, credential_id, status,
        last_commit_sha, last_commit_message, last_commit_author, last_commit_at,
        expose_service, expose_port, domain_suffix, custom_domain, https, env_vars, last_deployed_at, last_error, created_at, updated_at
      ) VALUES (
        $id, $name, $slug, $git_url, $branch, $credential_id, $status,
        $last_commit_sha, $last_commit_message, $last_commit_author, $last_commit_at,
        $expose_service, $expose_port, $domain_suffix, $custom_domain, $https, $env_vars, $last_deployed_at, $last_error, $created_at, $updated_at
      )`,
    )
    .run({ ...row, created_at, updated_at });
  return { ...row, created_at, updated_at };
}

export function updateProject(
  id: string,
  patch: Partial<Omit<Project, "id" | "created_at">>,
): void {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  const sets = keys.map((key) => `${key} = $${key}`).join(", ");
  getDb()
    .query(`UPDATE projects SET ${sets}, updated_at = $updated_at WHERE id = $id`)
    .run({ ...patch, id, updated_at: nowIso() });
}

export function deleteProjectRow(id: string): void {
  const db = getDb();
  const wipe = db.transaction(() => {
    db.query("DELETE FROM deploy_logs WHERE project_id = ?").run(id);
    db.query("DELETE FROM projects WHERE id = ?").run(id);
  });
  wipe();
}

export function setProjectStatus(
  id: string,
  status: ProjectStatus,
  extra?: Partial<Project>,
): void {
  updateProject(id, { status, ...extra });
}
