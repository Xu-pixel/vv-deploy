import { existsSync } from "node:fs";
import { generatedComposePath, generatedEnvPath, repoDir } from "./paths";
import { formatResult, runCommand } from "./exec";

export function composeArgs(slug: string, extra: string[]): string[] {
  const args = ["docker", "compose"];
  const envFile = generatedEnvPath(slug);
  if (existsSync(envFile)) {
    args.push("--env-file", envFile);
  }
  args.push(
    "-f",
    generatedComposePath(slug),
    "--project-directory",
    repoDir(slug),
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
  opts?: { build?: boolean },
): Promise<void> {
  if (!existsSync(generatedComposePath(slug))) {
    throw new Error("还没有生成 compose，无法部署");
  }
  const extra = opts?.build === false ? ["up", "-d"] : ["up", "-d", "--build"];
  const result = await runCommand(withTty(composeArgs(slug, extra)), {
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
  if (!existsSync(generatedComposePath(slug))) return;
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
  if (!existsSync(generatedComposePath(slug))) return [];
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
  if (!existsSync(generatedComposePath(slug))) return [];
  const result = await runCommand(
    composeArgs(slug, ["config", "--services"]),
  );
  if (result.code !== 0) return [];
  return result.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
