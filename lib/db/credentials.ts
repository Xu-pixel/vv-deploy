import "server-only";

import { getDb, nowIso } from "./index";
import type { GitCredential, GitProvider } from "./types";

export function listCredentials(): GitCredential[] {
  return getDb()
    .query<GitCredential, []>(
      "SELECT * FROM git_credentials ORDER BY created_at DESC",
    )
    .all();
}

export function getCredential(id: string): GitCredential | null {
  return getDb()
    .query<GitCredential, [string]>("SELECT * FROM git_credentials WHERE id = ?")
    .get(id);
}

export function insertCredential(row: Omit<GitCredential, "created_at">): GitCredential {
  const created_at = nowIso();
  getDb()
    .query(
      `INSERT INTO git_credentials (id, name, provider, public_key, private_key_path, created_at)
       VALUES ($id, $name, $provider, $public_key, $private_key_path, $created_at)`,
    )
    .run({ ...row, created_at });
  return { ...row, created_at };
}

export function deleteCredential(id: string): void {
  getDb().query("DELETE FROM git_credentials WHERE id = ?").run(id);
}

export function countProjectsUsingCredential(id: string): number {
  const row = getDb()
    .query<{ n: number }, [string]>(
      "SELECT COUNT(*) AS n FROM projects WHERE credential_id = ?",
    )
    .get(id);
  return row?.n ?? 0;
}

export function isProvider(value: string): value is GitProvider {
  return value === "gitee" || value === "github" || value === "other";
}
