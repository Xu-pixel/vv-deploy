import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteProjectAction,
  deployProjectAction,
  stopProjectAction,
} from "@/app/actions/projects";
import { ActionForm } from "@/components/action-form";
import { EnvForm } from "@/components/env-form";
import { ErrorToast } from "@/components/error-toast";
import { ContainerLogs } from "@/components/container-logs";
import { DeployHistory } from "@/components/deploy-history";
import { DeployTicker } from "@/components/deploy-ticker";
import { LiveStatus } from "@/components/live-status";
import { ProjectProgressProvider } from "@/components/project-progress";
import { CopyButton } from "@/components/copy-button";
import { CopyLink } from "@/components/copy-link";
import { RepoCard } from "@/components/repo-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectBranches } from "@/components/project-branches";
import { SquareIcon } from "lucide-react";
import { isAdmin } from "@/lib/auth";
import { readConfig } from "@/lib/config";
import { listDeploys } from "@/lib/db/deploys";
import { getProject } from "@/lib/db/projects";
import { isBusy } from "@/lib/deploy";
import { getProgressLine } from "@/lib/progress";
import { findDeployComposeFile } from "@/lib/git";
import { repoDir } from "@/lib/paths";
import { findProjectIcon, projectIconUrl } from "@/lib/project-icon";
import { readProjectFace } from "@/lib/project-face";
import { basename } from "node:path";
import { projectHost, resolveDomainSuffix } from "@/lib/slug";
import { parseCompose } from "@/lib/compose";
import { activeEnvPath, dumpDotenv, loadProjectEnv } from "@/lib/env";
import { existsSync, readFileSync } from "node:fs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();

  const admin = await isAdmin();
  const config = readConfig();
  const domainSuffix = resolveDomainSuffix(project.domain_suffix, config.domainSuffixes);
  const face = readProjectFace(project, projectHost(project.slug, domainSuffix));
  const envFileName = basename(activeEnvPath(project.slug));
  const composeFile = findDeployComposeFile(repoDir(project.slug));
  let serviceNames: string[] = [];
  if (serviceNames.length === 0 && composeFile && existsSync(composeFile)) {
    try { serviceNames = Object.keys(parseCompose(readFileSync(composeFile, "utf8")).services ?? {}); } catch { /* 日志仍可查询全部服务 */ }
  }
  const busy = isBusy(project.status);
  const href = `/app/${project.id}`;
  const iconUrl = findProjectIcon(project.slug)
    ? projectIconUrl(project.id, project.last_commit_sha)
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <ProjectProgressProvider
        id={project.id}
        key={project.id}
        initialStatus={project.status}
        initialLine={busy ? getProgressLine(project.id).line : ""}
        initialPercent={getProgressLine(project.id).percent}
        initialError={project.last_error}
      >
      <div className="project-intro bg-background">
        <header className="project-header flex items-center justify-between gap-6 px-6 md:px-10">
          {admin ? (
            <Link href="/" className="text-sm text-[var(--mute)] hover:text-[var(--ink)]">
              全部项目
            </Link>
          ) : (
            <span className="text-sm text-[var(--mute)]">vvDeploy</span>
          )}
          <LiveStatus />
        </header>

        <section className="project-overview mx-auto w-full px-6 pb-4 md:px-10">
          <div className="card overflow-hidden rounded-lg">
          <div className="p-5">
          <RepoCard
            project={project}
            face={face}
            iconUrl={iconUrl}
            titleAs="h1"
            gitUrl
            trailing={
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <ActionForm action={deployProjectAction}>
                  <input type="hidden" name="id" value={project.id} />
                  <Button type="submit" disabled={busy}>
                    拉取并部署
                  </Button>
                </ActionForm>
                <ActionForm action={stopProjectAction}>
                  <input type="hidden" name="id" value={project.id} />
                  <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    title={
                      project.status === "cloning"
                        ? "停止克隆"
                        : project.status === "building"
                          ? "取消部署"
                          : "停止"
                    }
                    aria-label={
                      project.status === "cloning"
                        ? "停止克隆"
                        : project.status === "building"
                          ? "取消部署"
                          : "停止"
                    }
                  >
                    <SquareIcon />
                  </Button>
                </ActionForm>
                <CopyLink path={href} label="复制维护链接" icon />
              </div>
            }
            footer={
              <>
          <ErrorToast id={project.id} message={project.last_error} />
          <ProjectBranches key={`${project.id}:${project.branch}`} id={project.id} branch={project.branch} busy={busy} />
              </>
            }
          />
          </div>
          <DeployTicker />
          </div>
        </section>
      </div>

      <main className="project-details mx-auto w-full flex-1 px-6 pt-4 pb-10 md:px-10">
        <div className="project-column">
          <DeployHistory id={project.id} initial={listDeploys(project.id)} />
        </div>
        <div className="project-column">
        <section>
          <h2 className="text-sm text-[var(--mute)]">环境变量</h2>
          <p className="mt-1 font-mono text-xs text-[var(--mute)]">{envFileName}</p>
          <EnvForm
            key={project.updated_at}
            id={project.id}
            initialText={dumpDotenv(loadProjectEnv(project.slug, project.env_vars))}
            busy={busy}
          />
        </section>

        <section>
          <h2 className="text-sm text-[var(--mute)]">容器日志</h2>
          <div className="mt-2">
            <ContainerLogs id={project.id} services={serviceNames} />
          </div>
        </section>

        <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
          <h2 className="text-sm font-medium text-destructive">删除项目</h2>
          <p className="mt-2 text-sm leading-7 text-destructive/80">
            会停掉并删除该项目的容器、数据卷和网络，再删除 REPOS_DIR 下的仓库目录。外部网络不会动。输入{" "}
            <CopyButton value={project.slug} label="复制项目名" className="font-mono">
              {project.slug}
            </CopyButton>{" "}
            确认。
          </p>
          <ActionForm action={deleteProjectAction} className="mt-3 flex gap-3">
            <input type="hidden" name="id" value={project.id} />
            <Input name="confirm" placeholder={project.slug} required />
            <Button type="submit" variant="destructive">
              删除
            </Button>
          </ActionForm>
        </section>
        </div>
      </main>
      </ProjectProgressProvider>
    </div>
  );
}
