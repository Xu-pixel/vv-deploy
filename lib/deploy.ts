import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readConfig } from "./config";
import { projectUsesHttps } from "./letsencrypt";
import { resolveDomainSuffix } from "./slug";
import { dumpCompose, rewriteCompose } from "./compose";
import { parseEnvJson, syncProjectEnvFile } from "./env";
import { getCredential } from "./db/credentials";
import { getProject, setProjectStatus, updateProject } from "./db/projects";
import { composeDown, composeUp } from "./docker";
import { cloneRepo, findComposeFile, inspectRepo, isGitRepo, pullRepo } from "./git";
import {
  ensureRuntimeDirs,
  generatedComposePath,
  overridesDir,
  repoDir,
  volumesDir,
} from "./paths";
import { CommandAbortedError } from "./exec";
import { clearProgress, flushProgress, progressSink, setProgressLine } from "./progress";
import type { Project } from "./db/types";

const jobs = new Map<string, AbortController>();
const pendingCancel = new Set<string>();

export function beginJob(id: string): AbortController | null {
  if (jobs.has(id)) return null;
  const controller = new AbortController();
  if (pendingCancel.delete(id)) controller.abort();
  jobs.set(id, controller);
  flushProgress(id);
  return controller;
}

function endJob(id: string): void {
  jobs.delete(id);
  flushProgress(id);
}

export function jobAlive(id: string): boolean {
  return jobs.has(id);
}

export function cancelJob(id: string): boolean {
  const controller = jobs.get(id);
  if (controller) {
    controller.abort();
    return true;
  }
  pendingCancel.add(id);
  const project = getProject(id);
  if (project && isBusy(project.status)) {
    setProjectStatus(id, "idle", { last_error: null });
  }
  clearProgress(id);
  return true;
}

export function generateOverride(project: Project): { notes: string[] } {
  const config = readConfig();
  const domainSuffix = resolveDomainSuffix(project.domain_suffix, config.domainSuffixes);
  if (!domainSuffix) {
    throw new Error("请先在设置里填写域名后缀");
  }
  const repo = repoDir(project.slug);
  const composeFile = findComposeFile(repo);
  if (!composeFile) {
    throw new Error("仓库里没有找到 docker-compose / compose 文件");
  }
  const https = projectUsesHttps(config, domainSuffix);
  const env = parseEnvJson(project.env_vars);
  const rewritten = rewriteCompose({
    text: readFileSync(composeFile, "utf8"),
    slug: project.slug,
    domainSuffix,
    traefikNetwork: config.traefikNetwork || "traefik",
    exposeService: project.expose_service,
    exposePort: project.expose_port,
    certResolver: https ? "letsencrypt" : undefined,
    env,
  });
  mkdirSync(overridesDir(project.slug), { recursive: true });
  mkdirSync(volumesDir(project.slug), { recursive: true });
  writeFileSync(generatedComposePath(project.slug), dumpCompose(rewritten.compose), "utf8");
  syncProjectEnvFile(project.slug, env);
  updateProject(project.id, {
    expose_service: rewritten.exposeService,
    expose_port: rewritten.exposePort,
  });
  return {
    notes: rewritten.volumeNotes.map((n) => `${n.reason}：${n.from} → ${n.to}`),
  };
}

async function syncRepo(
  project: Project,
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
): Promise<void> {
  if (!project.credential_id) {
    throw new Error("项目没有绑定 Git 凭证");
  }
  const cred = getCredential(project.credential_id);
  if (!cred) throw new Error("Git 凭证不存在");
  ensureRuntimeDirs();
  const dest = repoDir(project.slug);
  if (isGitRepo(dest)) {
    setProgressLine(project.id, "正在拉取…", 6);
    await pullRepo({
      dest,
      branch: project.branch,
      privateKeyPath: cred.private_key_path,
      onChunk,
      signal,
    });
  } else {
    if (existsSync(dest)) {
      rmSync(dest, { recursive: true, force: true });
    }
    setProgressLine(project.id, "正在克隆…", 6);
    await cloneRepo({
      url: project.git_url,
      dest,
      branch: project.branch || undefined,
      privateKeyPath: cred.private_key_path,
      onChunk,
      signal,
    });
  }
  const info = await inspectRepo(dest);
  updateProject(project.id, {
    last_commit_sha: info.sha,
    last_commit_message: info.message,
    last_commit_author: info.author,
    last_commit_at: info.committedAt,
  });
}

function finishCancelled(projectId: string, mode: "clone" | "deploy"): void {
  const project = getProject(projectId);
  if (mode === "clone" && project && !project.last_commit_sha) {
    const dest = repoDir(project.slug);
    if (existsSync(dest)) {
      rmSync(dest, { recursive: true, force: true });
    }
  }
  setProjectStatus(projectId, "idle", { last_error: null });
}

export async function runClone(projectId: string): Promise<void> {
  const controller = beginJob(projectId);
  if (!controller) return;
  try {
    const project = getProject(projectId);
    if (!project) throw new Error("项目不存在");
    setProjectStatus(projectId, "cloning", { last_error: null });
    const onChunk = progressSink(projectId);
    setProgressLine(projectId, "开始拉取…", 2);
    await syncRepo(project, controller.signal, onChunk);
    const latest = getProject(projectId);
    if (latest) {
      try {
        generateOverride(latest);
      } catch {
        /* compose 可能还没有，接入后仍可改设置再部署 */
      }
    }
    setProjectStatus(projectId, "idle");
  } catch (err) {
    if (err instanceof CommandAbortedError) {
      finishCancelled(projectId, "clone");
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    const clipped = message.length > 8000 ? message.slice(-8000) : message;
    setProjectStatus(projectId, "error", { last_error: clipped });
    setProgressLine(projectId, clipped);
    flushProgress(projectId);
  } finally {
    endJob(projectId);
    if (getProject(projectId)?.status !== "error") clearProgress(projectId);
  }
}

export async function runDeploy(
  projectId: string,
  existing?: AbortController,
): Promise<void> {
  const controller = existing ?? beginJob(projectId);
  if (!controller) return;
  try {
    const project = getProject(projectId);
    if (!project) throw new Error("项目不存在");
    setProjectStatus(projectId, "building", { last_error: null });
    const onChunk = progressSink(projectId);
    setProgressLine(projectId, "开始部署…", 2);
    await syncRepo(project, controller.signal, onChunk);
    const latest = getProject(projectId);
    if (!latest) throw new Error("项目不存在");
    setProgressLine(projectId, "正在改写 compose…", 12);
    generateOverride(latest);
    setProgressLine(projectId, "docker compose up --build", 15);
    await composeUp(latest.slug, onChunk, controller.signal);
    setProgressLine(projectId, "已启动", 100);
    setProjectStatus(projectId, "running", {
      last_deployed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof CommandAbortedError) {
      const project = getProject(projectId);
      if (project) {
        try {
          await composeDown(project.slug);
        } catch {
          /* ignore */
        }
      }
      finishCancelled(projectId, "deploy");
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    const clipped = message.length > 8000 ? message.slice(-8000) : message;
    setProjectStatus(projectId, "error", { last_error: clipped });
    setProgressLine(projectId, clipped);
    flushProgress(projectId);
  } finally {
    endJob(projectId);
    const status = getProject(projectId)?.status;
    if (status === "running") {
      setProgressLine(projectId, "已启动", 100);
      setTimeout(() => clearProgress(projectId), 2500);
    } else if (status !== "error") {
      clearProgress(projectId);
    }
  }
}

export async function runStop(projectId: string): Promise<void> {
  const project = getProject(projectId);
  if (!project) throw new Error("项目不存在");
  await composeDown(project.slug);
  clearProgress(projectId);
  setProjectStatus(projectId, "stopped");
}

export function isBusy(status: Project["status"]): boolean {
  return status === "cloning" || status === "building";
}
