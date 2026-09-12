"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin, requireAdmin } from "@/lib/auth";
import { readConfig } from "@/lib/config";
import { getCredential } from "@/lib/db/credentials";
import {
  deleteProjectRow,
  getProject,
  getProjectByGitUrl,
  getProjectBySlug,
  insertProject,
  setProjectStatus,
  updateProject,
} from "@/lib/db/projects";
import { beginJob, cancelJob, isBusy, jobAlive, runClone, runDeploy, runStop } from "@/lib/deploy";
import { setProgressLine } from "@/lib/progress";
import { listRemoteBranches, parseBranch } from "@/lib/git";
import { newProjectId } from "@/lib/id";
import { parseDotenv, stringifyEnvJson, syncProjectEnvFile } from "@/lib/env";
import { inferDomainSuffix, parseGitUrl, parseHostname, resolveDomainSuffix, slugifyRepo } from "@/lib/slug";

async function requireProjectAccess(id: string) {
  const project = getProject(id);
  if (!project) throw new Error("项目不存在");
  return project;
}

function uniqueSlug(base: string): string {
  let slug = base;
  let i = 2;
  while (getProjectBySlug(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

export async function createProjectAction(
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const git_url = String(formData.get("git_url") ?? "").trim();
  const credential_id = String(formData.get("credential_id") ?? "").trim();
  const cred = getCredential(credential_id);
  if (!git_url) return { error: "请填写 SSH 仓库地址" };
  if (!credential_id || !cred) {
    return { error: "请选择 Git 凭证" };
  }
  const branchRaw = String(formData.get("branch") ?? "").trim();
  let branch = branchRaw ? parseBranch(branchRaw) : null;
  if (branchRaw && !branch) return { error: "分支名不合法" };
  if (!branch) {
    try {
      const remote = await listRemoteBranches({
        url: git_url,
        privateKeyPath: cred.private_key_path,
      });
      branch = remote.defaultBranch ?? remote.branches[0] ?? "main";
    } catch (err) {
      return { error: err instanceof Error ? err.message : "检索远程分支失败" };
    }
  }
  const parsed = parseGitUrl(git_url);
  if (!parsed) return { error: "无法解析仓库地址，请使用 SSH URL" };
  const existing = getProjectByGitUrl(git_url, branch);
  if (existing) {
    if (isBusy(existing.status)) return { error: "该仓库正在拉取或部署" };
    after(() => runClone(existing.id));
    redirect(`/app/${existing.id}`);
  }
  const id = newProjectId();
  const slug = uniqueSlug(slugifyRepo(parsed.repo));
  insertProject({
    id,
    name: parsed.repo,
    slug,
    git_url,
    branch,
    credential_id,
    status: "cloning",
    last_commit_sha: null,
    last_commit_message: null,
    last_commit_author: null,
    last_commit_at: null,
    expose_service: null,
    expose_port: null,
    domain_suffix: null,
    custom_domain: null,
    env_vars: "{}",
    last_deployed_at: null,
    last_error: null,
  });
  after(() => runClone(id));
  redirect(`/app/${id}`);
}

export async function deployProjectAction(
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const id = String(formData.get("id") ?? "");
  const project = await requireProjectAccess(id);
  if (isBusy(project.status) || jobAlive(id)) return { error: "正在拉取或部署" };
  const controller = beginJob(id);
  if (!controller) return { error: "正在拉取或部署" };
  setProjectStatus(id, "building", { last_error: null });
  setProgressLine(id, "开始部署…", 2);
  after(() => runDeploy(id, controller));
  return { ok: "开始部署" };
}

export async function stopProjectAction(
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const id = String(formData.get("id") ?? "");
  const project = await requireProjectAccess(id);
  try {
    if (isBusy(project.status)) {
      cancelJob(id);
      revalidatePath(`/app/${id}`);
      revalidatePath("/");
      return {
        ok: project.status === "cloning" ? "已停止克隆" : "已取消部署",
      };
    }
    await runStop(id);
    revalidatePath(`/app/${id}`);
    revalidatePath("/");
    return { ok: "已停止" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "停止失败" };
  }
}

export async function peekRemoteBranchesAction(
  gitUrl: string,
  credentialId: string,
): Promise<{ branches: string[]; defaultBranch: string | null; error?: string }> {
  await requireAdmin();
  const cred = getCredential(credentialId);
  if (!cred) return { branches: [], defaultBranch: null, error: "请选择 Git 凭证" };
  const url = gitUrl.trim();
  if (!url) return { branches: [], defaultBranch: null, error: "请填写 SSH 仓库地址" };
  try {
    return await listRemoteBranches({
      url,
      privateKeyPath: cred.private_key_path,
    });
  } catch (err) {
    return {
      branches: [],
      defaultBranch: null,
      error: err instanceof Error ? err.message : "检索远程分支失败",
    };
  }
}

export async function saveProjectSettingsAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const id = String(formData.get("id") ?? "");
  const project = await requireProjectAccess(id);
  if (isBusy(project.status)) return { error: "正在拉取或部署，稍后再改设置" };
  const branch = parseBranch(String(formData.get("branch") ?? project.branch));
  if (!branch) return { error: "分支名不合法" };
  const expose_service = String(formData.get("expose_service") ?? "").trim() || null;
  const portRaw = String(formData.get("expose_port") ?? "").trim();
  const expose_port = portRaw ? Number(portRaw) : null;
  const suffixes = readConfig().domainSuffixes;
  const domain_suffix =
    resolveDomainSuffix(String(formData.get("domain_suffix") ?? ""), suffixes) || null;
  const parsedHost = parseHostname(String(formData.get("custom_domain") ?? ""));
  if (parsedHost === null) return { error: "域名不合法" };
  const custom_domain = parsedHost || null;
  updateProject(id, {
    branch,
    expose_service,
    expose_port: expose_port && Number.isFinite(expose_port) ? expose_port : null,
    domain_suffix: custom_domain
      ? inferDomainSuffix(custom_domain, suffixes) ?? domain_suffix
      : domain_suffix,
    custom_domain,
  });
  revalidatePath(`/app/${id}`);
  revalidatePath("/");
  return {};
}

export async function saveProjectEnvAction(
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const id = String(formData.get("id") ?? "");
  const project = await requireProjectAccess(id);
  if (isBusy(project.status)) return { error: "正在拉取或部署，稍后再改环境变量" };
  const parsed = parseDotenv(String(formData.get("env_text") ?? ""));
  if ("error" in parsed) return parsed;
  updateProject(id, { env_vars: stringifyEnvJson(parsed.ok) });
  syncProjectEnvFile(project.slug, parsed.ok);
  revalidatePath(`/app/${id}`);
  return { ok: "已保存，重新部署后生效" };
}

export async function deleteProjectAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const id = String(formData.get("id") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim();
  const project = await requireProjectAccess(id);
  if (confirm !== project.slug) {
    return { error: "确认名与仓库名不一致" };
  }
  const admin = await isAdmin();
  cancelJob(id);
  try {
    await runStop(id);
  } catch {
    // already gone
  }
  deleteProjectRow(id);
  revalidatePath("/");
  if (admin) redirect("/");
  redirect("/login");
}
