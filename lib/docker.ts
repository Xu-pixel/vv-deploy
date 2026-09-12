import { existsSync } from "node:fs";
import { findDeployComposeFile } from "./git";
import { formatResult, runCommand } from "./exec";
import { projectEnvPath, repoDir } from "./paths";

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
  const envFile = projectEnvPath(slug);
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
  if (process.platform === "darwin") {
    return ["script", "-q", "/dev/null", ...argv];
  }
  if (process.platform === "linux") {
    const inner = argv
      .map((part) => `'${part.replace(/'/g, `'\\''`)}'`)
      .join(" ");
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
