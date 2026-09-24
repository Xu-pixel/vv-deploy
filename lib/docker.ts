import { existsSync } from "node:fs";
import { TERM_COLS, TERM_ROWS } from "./term-screen";
import { findDeployComposeFile } from "./git";
import { formatResult, runCommand } from "./exec";
import { activeEnvPath } from "./env";
import { repoDir } from "./paths";

export function composeFilePath(slug: string): string | null {
  return findDeployComposeFile(repoDir(slug));
}

export function composeArgs(slug: string, extra: string[]): string[] {
  const repo = repoDir(slug);
  const composeFile = findDeployComposeFile(repo);
  if (!composeFile) {
    throw new Error("仓库里没有 docker-compose.deploy.yaml");
  }
  const args = ["docker", "compose"];
  const envFile = activeEnvPath(slug);
  if (existsSync(envFile)) {
    args.push("--env-file", envFile);
  }
  args.push(
    "-f",
    composeFile,
    "--project-directory",
    repo,
    "--project-name",
    slug,
    ...extra,
  );
  return args;
}

function withTty(argv: string[]): string[] {
  const quoted = argv.map((part) => `'${part.replace(/'/g, `'\\''`)}'`).join(" ");
  const inner = `stty rows ${TERM_ROWS} cols ${TERM_COLS}; ${quoted}`;
  if (process.platform === "darwin") {
    return ["script", "-q", "/dev/null", "sh", "-c", inner];
  }
  if (process.platform === "linux") {
    return ["script", "-qefc", inner, "/dev/null"];
  }
  return argv;
}

export async function composeUp(
  slug: string,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!composeFilePath(slug)) {
    throw new Error("仓库里没有 docker-compose.deploy.yaml，无法部署");
  }
  const result = await runCommand(withTty(composeArgs(slug, ["up", "-d", "--build"])), {
    onChunk,
    signal,
  });
  if (result.code !== 0) {
    throw new Error(`docker compose up 失败\n${formatResult(result)}`);
  }
}

function isAlreadyDown(result: { stdout: string; stderr: string }): boolean {
  const text = `${result.stdout}\n${result.stderr}`;
  return /failed to connect to the docker API|cannot connect to the [Dd]ocker|Is the docker daemon running|dial unix|No containers? to (stop|remove)|no container/i.test(
    text,
  );
}

export async function composeDown(slug: string): Promise<void> {
  if (!composeFilePath(slug)) return;
  const result = await runCommand(composeArgs(slug, ["down"]));
  if (result.code === 0 || isAlreadyDown(result)) return;
  throw new Error(`docker compose down 失败：${formatResult(result)}`);
}

export function composeLogsArgs(
  slug: string,
  opts: { service?: string; tail: number; follow: boolean },
): string[] {
  const extra = ["logs", "--no-color", "--timestamps", "--tail", String(opts.tail)];
  if (opts.follow) extra.push("-f");
  if (opts.service) extra.push(opts.service);
  return composeArgs(slug, extra);
}

export type ComposeRuntime = {
  status: "running" | "stopped" | "idle";
  containers: string[];
};

export function runtimeFromPs(lines: string[]): ComposeRuntime {
  const rows = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tab = line.lastIndexOf("\t");
      const name = (tab >= 0 ? line.slice(0, tab) : line).trim();
      const state = (tab >= 0 ? line.slice(tab + 1) : "").trim().toLowerCase();
      return { name, state };
    })
    .filter((row) => row.name);
  const containers = rows
    .filter((row) => row.state === "running" || row.state === "restarting")
    .map((row) => row.name);
  if (rows.length === 0) return { status: "idle", containers: [] };
  if (containers.length > 0) return { status: "running", containers };
  return { status: "stopped", containers: [] };
}

export async function inspectComposeRuntime(slug: string): Promise<ComposeRuntime | null> {
  if (!composeFilePath(slug)) return { status: "idle", containers: [] };
  const result = await runCommand(
    composeArgs(slug, ["ps", "-a", "--format", "{{.Name}}\t{{.State}}"]),
  );
  if (result.code !== 0) return null;
  return runtimeFromPs(result.stdout.split("\n"));
}

export async function listComposeContainers(slug: string): Promise<string[]> {
  if (!composeFilePath(slug)) return [];
  const result = await runCommand(
    composeArgs(slug, ["ps", "--format", "{{.Name}}"]),
  );
  if (result.code !== 0) return [];
  return result.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function listComposeServices(slug: string): Promise<string[]> {
  if (!composeFilePath(slug)) return [];
  const result = await runCommand(
    composeArgs(slug, ["config", "--services"]),
  );
  if (result.code !== 0) return [];
  return result.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
