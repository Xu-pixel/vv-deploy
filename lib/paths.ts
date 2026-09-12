import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export function projectRoot(): string {
  return process.env.VV_ROOT ?? process.cwd();
}

export function configPath(): string {
  return join(projectRoot(), "data", "config.json");
}

export function sqlitePath(): string {
  return join(projectRoot(), "data", "vv.sqlite");
}

export function bootstrapKeyPath(): string {
  return join(projectRoot(), "data", ".bootstrap-key");
}

export function secretsDir(): string {
  return join(projectRoot(), "secrets");
}

/** Host path for cloned repos. Must match inside the panel container (bind-mounted). */
export function reposDir(): string {
  const fromEnv = process.env.REPOS_DIR?.trim();
  return fromEnv || join(projectRoot(), "repos");
}

export function repoDir(slug: string): string {
  return join(reposDir(), slug);
}

export function repoExists(slug: string): boolean {
  const dir = repoDir(slug);
  return existsSync(dir) && statSync(dir).isDirectory();
}

export function listRepoSlugs(): string[] {
  const root = reposDir();
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

export function projectEnvPath(slug: string): string {
  return join(repoDir(slug), ".env");
}

export function traefikDir(): string {
  return join(projectRoot(), "data", "traefik");
}

export function letsEncryptDir(): string {
  return join(projectRoot(), "data", "letsencrypt");
}

export function ensureRuntimeDirs(): void {
  for (const dir of [
    join(projectRoot(), "data"),
    traefikDir(),
    letsEncryptDir(),
    reposDir(),
    secretsDir(),
  ]) {
    mkdirSync(dir, { recursive: true });
  }
}
