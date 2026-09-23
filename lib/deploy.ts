import { existsSync, rmSync } from "node:fs";
import { getCredential } from "./db/credentials";
import { finishDeploy, insertDeploy, listRunningDeploys } from "./db/deploys";
import { getProject, setProjectStatus, updateProject } from "./db/projects";
import { composeDown, composeUp } from "./docker";
import { appendDeployLog } from "./deploy-log";
import { loadProjectEnv, stringifyEnvJson, writeProjectEnvFile } from "./env";
import { cloneRepo, inspectRepo, isGitRepo, pullRepo } from "./git";
import { ensureRuntimeDirs, repoDir } from "./paths";
import { CommandAbortedError } from "./exec";
import { clearProgress, flushProgress, progressSink, setProgressLine } from "./progress";
import type { DeployRunStatus, Project } from "./db/types";

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

export function syncManagedEnv(project: Project): void {
  const env = loadProjectEnv(project.slug, project.env_vars);
  writeProjectEnvFile(project.slug, env);
  updateProject(project.id, { env_vars: stringifyEnvJson(env) });
}

async function syncRepo(
  project: Project,
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
): Promise<void> {
  ensureRuntimeDirs();
  const dest = repoDir(project.slug);
  if (isGitRepo(dest)) {
    if (project.credential_id) {
      const cred = getCredential(project.credential_id);
      if (!cred) throw new Error("Git 凭证不存在");
      setProgressLine(project.id, "正在拉取…", 6);
      await pullRepo({
        dest,
        branch: project.branch,
        privateKeyPath: cred.private_key_path,
        onChunk,
        signal,
      });
    }
  } else if (!existsSync(dest)) {
    if (!project.credential_id) {
      throw new Error("项目没有绑定 Git 凭证");
    }
    const cred = getCredential(project.credential_id);
    if (!cred) throw new Error("Git 凭证不存在");
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
  if (!isGitRepo(dest)) return;
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
    if (latest) syncManagedEnv(latest);
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

function writeDeployLog(projectId: string, deployId: string | null, text: string): void {
  if (!deployId || !text) return;
  try {
    appendDeployLog(projectId, deployId, text);
  } catch {
    /* 日志写失败不中断部署 */
  }
}

export function closeStaleDeploys(): void {
  for (const row of listRunningDeploys()) {
    if (jobs.has(row.project_id)) continue;
    writeDeployLog(row.project_id, row.id, "\n进程已重启，这次部署没有完成。\n");
    finishDeploy(row.id, "error");
  }
}

export async function runDeploy(
  projectId: string,
  existing?: AbortController,
): Promise<void> {
  const controller = existing ?? beginJob(projectId);
  if (!controller) return;
  let deployId: string | null = null;
  const note = (line: string) => writeDeployLog(projectId, deployId, `${line}\n`);
  const sink = progressSink(projectId);
  const onChunk = (chunk: string) => {
    sink(chunk);
    writeDeployLog(projectId, deployId, chunk);
  };
  const settle = (status: Exclude<DeployRunStatus, "running">, line: string) => {
    if (!deployId) return;
    note(line);
    finishDeploy(deployId, status);
  };
  try {
    const project = getProject(projectId);
    if (!project) throw new Error("项目不存在");
    setProjectStatus(projectId, "building", { last_error: null });
    deployId = insertDeploy(projectId).id;
    note("开始部署");
    setProgressLine(projectId, "开始部署…", 2);
    await syncRepo(project, controller.signal, onChunk);
    const latest = getProject(projectId);
    if (!latest) throw new Error("项目不存在");
    setProgressLine(projectId, "写入 .env", 12);
    note("写入 .env");
    syncManagedEnv(latest);
    setProgressLine(projectId, "docker compose -f docker-compose.deploy.yaml up --build", 15);
    note("docker compose -f docker-compose.deploy.yaml up --build");
    await composeUp(latest.slug, onChunk, controller.signal);
    setProgressLine(projectId, "已启动", 100);
    settle("success", "已启动");
    setProjectStatus(projectId, "running", {
      last_deployed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof CommandAbortedError) {
      settle("cancelled", "已取消");
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
    const headline = clipped.split("\n").find((line) => line.trim()) ?? "部署失败";
    settle("error", headline);
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
