import { chmodSync, existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readDeploySurface } from "./deploy-surface";
import { findDeployComposeFile } from "./git";
import { projectEnvPath, repoDir } from "./paths";

export type EnvMap = Record<string, string>;

const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseEnvJson(raw: string | null | undefined): EnvMap {
  if (!raw?.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: EnvMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!ENV_KEY.test(key)) continue;
      if (typeof value === "string") out[key] = value;
      else if (value == null) out[key] = "";
      else out[key] = String(value);
    }
    return out;
  } catch {
    return {};
  }
}

export function stringifyEnvJson(vars: EnvMap): string {
  return JSON.stringify(vars);
}

function unquoteDotenvValue(raw: string): string {
  if (raw.length >= 2) {
    const quote = raw[0];
    if ((quote === '"' || quote === "'") && raw.endsWith(quote)) {
      const inner = raw.slice(1, -1);
      if (quote === '"') {
        return inner
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
      }
      return inner;
    }
  }
  return raw;
}

export function parseDotenv(text: string): { ok: EnvMap } | { error: string } {
  const out: EnvMap = {};
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = (lines[i] ?? "").trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const line = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const eq = line.indexOf("=");
    if (eq <= 0) return { error: `第 ${i + 1} 行不是 NAME=value` };
    const key = line.slice(0, eq).trim();
    if (!ENV_KEY.test(key)) return { error: `环境变量名不合法：${key}` };
    out[key] = unquoteDotenvValue(line.slice(eq + 1));
  }
  return { ok: out };
}

export function parseEnvForm(
  keys: string[],
  values: string[],
): { ok: EnvMap } | { error: string } {
  const out: EnvMap = {};
  const n = Math.max(keys.length, values.length);
  for (let i = 0; i < n; i += 1) {
    const key = (keys[i] ?? "").trim();
    const value = values[i] ?? "";
    if (!key && !value) continue;
    if (!key) return { error: "环境变量名不能为空" };
    if (!ENV_KEY.test(key)) return { error: `环境变量名不合法：${key}` };
    if (key in out) return { error: `重复的环境变量：${key}` };
    out[key] = value;
  }
  return { ok: out };
}

function quoteDotenv(value: string): string {
  if (value === "" || /[\s#"'$\\]/.test(value) || value.includes("\n")) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }
  return value;
}

export function dumpDotenv(vars: EnvMap): string {
  const lines = Object.entries(vars).map(([key, value]) => `${key}=${quoteDotenv(value)}`);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

export function declaredEnvFiles(repoPath: string): string[] {
  const composeFile = findDeployComposeFile(repoPath);
  if (!composeFile) return [];
  try {
    return readDeploySurface(readFileSync(composeFile, "utf8")).envFiles;
  } catch {
    return [];
  }
}

/** Compose `env_file` when that file exists; otherwise the repo `.env`. */
export function activeEnvPath(slug: string): string {
  const repo = repoDir(slug);
  for (const rel of declaredEnvFiles(repo)) {
    const full = join(repo, rel);
    if (existsSync(full) && statSync(full).isFile()) return full;
  }
  return projectEnvPath(slug);
}

export function readProjectEnvFile(slug: string): EnvMap | null {
  const file = activeEnvPath(slug);
  if (!existsSync(file)) return null;
  const parsed = parseDotenv(readFileSync(file, "utf8"));
  if ("error" in parsed) return null;
  return parsed.ok;
}

export function loadProjectEnv(slug: string, fallbackJson?: string | null): EnvMap {
  return readProjectEnvFile(slug) ?? parseEnvJson(fallbackJson);
}

export function writeProjectEnvFile(slug: string, vars: EnvMap): void {
  if (!existsSync(repoDir(slug))) return;
  const file = activeEnvPath(slug);
  if (Object.keys(vars).length === 0) {
    if (existsSync(file)) unlinkSync(file);
    return;
  }
  writeFileSync(file, dumpDotenv(vars), "utf8");
  chmodSync(file, 0o600);
}
