import { mkdirSync } from "node:fs";
import { join } from "node:path";

export function projectRoot(): string {
  return process.env.VV_ROOT ?? process.cwd();
}

/** Host paths written into generated compose files (docker.sock runs on the host). */
export function hostRoot(): string {
  return process.env.HOST_ROOT ?? projectRoot();
}

export function configPath(): string {
  return join(projectRoot(), "config.json");
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

export function reposDir(): string {
  return join(projectRoot(), "repos");
}

export function repoDir(slug: string): string {
  return join(reposDir(), slug);
}

export function volumesDir(slug: string): string {
  return join(projectRoot(), "volumes", slug);
}

export function hostVolumesDir(slug: string): string {
  return join(hostRoot(), "volumes", slug);
}

export function overridesDir(slug: string): string {
  return join(projectRoot(), "overrides", slug);
}

export function generatedComposePath(slug: string): string {
  return join(overridesDir(slug), "docker-compose.yml");
}

export function generatedEnvPath(slug: string): string {
  return join(overridesDir(slug), ".env");
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
    join(projectRoot(), "volumes"),
    join(projectRoot(), "overrides"),
    secretsDir(),
  ]) {
    mkdirSync(dir, { recursive: true });
  }
}
