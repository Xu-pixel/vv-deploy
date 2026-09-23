import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readDeploySurface } from "./deploy-surface";
import { formatResult, runCommand } from "./exec";
import { newRowId } from "./id";
import { secretsDir } from "./paths";
import type { GitProvider } from "./db/types";

export async function generateSshKey(
  name: string,
  provider: GitProvider,
): Promise<{ publicKey: string; privateKeyPath: string; id: string }> {
  const id = newRowId();
  mkdirSync(secretsDir(), { recursive: true });
  const privateKeyPath = join(secretsDir(), `git_${id}`);
  const result = await runCommand([
    "ssh-keygen",
    "-t",
    "ed25519",
    "-f",
    privateKeyPath,
    "-N",
    "",
    "-C",
    `vv-deploy@${name}`,
  ]);
  if (result.code !== 0) {
    throw new Error(`生成 SSH 密钥失败：${formatResult(result)}`);
  }
  chmodSync(privateKeyPath, 0o600);
  const publicKey = readFileSync(`${privateKeyPath}.pub`, "utf8").trim();
  void provider;
  return { publicKey, privateKeyPath, id };
}

function sshEnv(privateKeyPath: string): Record<string, string> {
  return {
    GIT_SSH_COMMAND: `ssh -i ${privateKeyPath} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`,
  };
}

export function isGitRepo(dest: string): boolean {
  return existsSync(join(dest, ".git"));
}

export async function cloneRepo(opts: {
  url: string;
  dest: string;
  branch?: string;
  privateKeyPath: string;
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const args = ["git", "clone", "--progress", "--recurse-submodules"];
  if (opts.branch) args.push("--branch", opts.branch);
  args.push(opts.url, opts.dest);
  const result = await runCommand(args, {
    env: sshEnv(opts.privateKeyPath),
    onChunk: opts.onChunk,
    signal: opts.signal,
  });
  if (result.code !== 0) {
    throw new Error(`git clone 失败：${formatResult(result)}`);
  }
}

export function parseLsRemote(stdout: string): {
  branches: string[];
  defaultBranch: string | null;
} {
  let defaultBranch: string | null = null;
  const branches: string[] = [];
  const seen = new Set<string>();
  for (const line of stdout.split("\n")) {
    const sym = line.match(/^ref:\s+refs\/heads\/(\S+)\s+HEAD\s*$/);
    if (sym) {
      defaultBranch = parseBranch(sym[1]);
      continue;
    }
    const head = line.match(/\trefs\/heads\/(.+)$/);
    if (!head) continue;
    const name = parseBranch(head[1]);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    branches.push(name);
  }
  return { branches, defaultBranch };
}

export async function listRemoteBranches(opts: {
  url: string;
  privateKeyPath: string;
}): Promise<{ branches: string[]; defaultBranch: string | null }> {
  const result = await runCommand(["git", "ls-remote", "--symref", opts.url], {
    env: sshEnv(opts.privateKeyPath),
  });
  if (result.code !== 0) {
    throw new Error(`检索远程分支失败：${formatResult(result)}`);
  }
  return parseLsRemote(result.stdout);
}

export function parseBranch(raw: string): string | null {
  const branch = raw.trim();
  if (!branch || branch.length > 200) return null;
  if (branch === "HEAD" || branch.startsWith("-")) return null;
  if (branch.includes("..") || branch.includes("\\") || /\s/.test(branch)) return null;
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) return null;
  return branch;
}

export async function pullRepo(opts: {
  dest: string;
  branch: string;
  privateKeyPath: string;
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const env = sshEnv(opts.privateKeyPath);
  const preserved = preserveEnvFiles(opts.dest);
  try {
    const fetch = await runCommand(["git", "fetch", "--progress", "origin", opts.branch], {
      cwd: opts.dest,
      env,
      onChunk: opts.onChunk,
      signal: opts.signal,
    });
    if (fetch.code !== 0) {
      throw new Error(`git fetch 失败：${formatResult(fetch)}`);
    }
    const checkout = await runCommand(
      ["git", "checkout", "-B", opts.branch, `origin/${opts.branch}`],
      {
        cwd: opts.dest,
        env,
        onChunk: opts.onChunk,
        signal: opts.signal,
      },
    );
    if (checkout.code !== 0) {
      throw new Error(`切换分支失败：${formatResult(checkout)}`);
    }
    const sub = await runCommand(
      ["git", "submodule", "update", "--init", "--recursive"],
      {
        cwd: opts.dest,
        env,
        onChunk: opts.onChunk,
        signal: opts.signal,
      },
    );
    if (sub.code !== 0) {
      throw new Error(`更新子模块失败：${formatResult(sub)}`);
    }
  } finally {
    for (const file of preserved) {
      writeFileSync(file.path, file.data);
      chmodSync(file.path, 0o600);
    }
  }
}

function preserveEnvFiles(dest: string): { path: string; data: Buffer }[] {
  const rels = new Set<string>([".env"]);
  const composeFile = findDeployComposeFile(dest);
  if (composeFile) {
    try {
      for (const rel of readDeploySurface(readFileSync(composeFile, "utf8")).envFiles) {
        rels.add(rel);
      }
    } catch {
      /* 读不到 compose 时仍保留 .env */
    }
  }
  const saved: { path: string; data: Buffer }[] = [];
  for (const rel of rels) {
    const path = join(dest, rel);
    if (!existsSync(path) || !statSync(path).isFile()) continue;
    saved.push({ path, data: readFileSync(path) });
  }
  return saved;
}

export type RepoInfo = {
  branch: string;
  sha: string;
  message: string;
  author: string;
  committedAt: string;
};

export async function inspectRepo(dest: string): Promise<RepoInfo> {
  const branch = await runCommand(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: dest,
  });
  const log = await runCommand(
    ["git", "log", "-1", "--format=%H%n%an%n%aI%n%s"],
    { cwd: dest },
  );
  if (log.code !== 0) {
    throw new Error(`读取仓库信息失败：${formatResult(log)}`);
  }
  const [sha, author, committedAt, ...rest] = log.stdout.trim().split("\n");
  return {
    branch: branch.stdout.trim() || "main",
    sha: sha ?? "",
    author: author ?? "",
    committedAt: committedAt ?? "",
    message: rest.join("\n"),
  };
}

export const DEPLOY_COMPOSE_FILES = [
  "docker-compose.deploy.yaml",
  "docker-compose.deploy.yml",
] as const;

export function findDeployComposeFile(repoPath: string): string | null {
  for (const name of DEPLOY_COMPOSE_FILES) {
    const full = join(/*turbopackIgnore: true*/ repoPath, name);
    if (existsSync(/*turbopackIgnore: true*/ full)) return full;
  }
  return null;
}

export function readLocalGitMeta(dest: string): { url: string; branch: string } {
  const snap = readRepoSnapshot(dest);
  return { url: snap.url, branch: snap.branch || "main" };
}

export type RepoSnapshot = {
  url: string;
  branch: string;
  sha: string | null;
  message: string | null;
  author: string | null;
  committedAt: string | null;
};

export function readRepoSnapshot(dest: string): RepoSnapshot {
  if (!isGitRepo(dest)) {
    return { url: "", branch: "", sha: null, message: null, author: null, committedAt: null };
  }
  const url = spawnGit(dest, ["remote", "get-url", "origin"]);
  const head = spawnGit(dest, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const raw = spawnGit(dest, ["log", "-1", "--format=%H%x1f%an%x1f%aI%x1f%s"]);
  const [sha, author, committedAt, message] = raw ? raw.split("\x1f") : [];
  return {
    url,
    branch: parseBranch(head) || "",
    sha: sha || null,
    author: author || null,
    committedAt: committedAt || null,
    message: message || null,
  };
}

function spawnGit(cwd: string, args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) return "";
  return result.stdout.toString().trim();
}
