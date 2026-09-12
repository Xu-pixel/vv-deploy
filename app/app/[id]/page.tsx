import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteProjectAction,
  deployProjectAction,
  saveProjectSettingsAction,
  stopProjectAction,
} from "@/app/actions/projects";
import { ActionForm } from "@/components/action-form";
import { EnvForm } from "@/components/env-form";
import { ErrorToast } from "@/components/error-toast";
import { ContainerLogs } from "@/components/container-logs";
import { DeployTicker } from "@/components/deploy-ticker";
import { LiveStatus } from "@/components/live-status";
import { ProjectProgressProvider } from "@/components/project-progress";
import { CopyButton } from "@/components/copy-button";
import { CopyLink } from "@/components/copy-link";
import { RepoCard } from "@/components/repo-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RocketIcon, SquareIcon } from "lucide-react";
import { isAdmin } from "@/lib/auth";
import { readConfig } from "@/lib/config";
import { getProject } from "@/lib/db/projects";
import { isBusy } from "@/lib/deploy";
import { getProgressLine } from "@/lib/progress";
import { listComposeServices } from "@/lib/docker";
import { projectRemoteBranches } from "@/lib/branches";
import { findComposeFile } from "@/lib/git";
import { repoDir } from "@/lib/paths";
import { projectOrigin } from "@/lib/letsencrypt";
import { findProjectIcon, projectIconUrl } from "@/lib/project-icon";
import { resolveDomainSuffix, resolveProjectHost } from "@/lib/slug";
import { parseCompose } from "@/lib/compose";
import { dumpDotenv, parseEnvJson } from "@/lib/env";
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
  const host = resolveProjectHost(project, config.domainSuffixes);
  const origin = projectOrigin(config, host, domainSuffix);
  const services = await listComposeServices(project.slug);
  const composeFile = findComposeFile(repoDir(project.slug));
  let serviceNames = services;
  if (serviceNames.length === 0 && composeFile && existsSync(composeFile)) {
    serviceNames = Object.keys(parseCompose(readFileSync(composeFile, "utf8")).services ?? {});
  }
  const busy = isBusy(project.status);
  const href = `/app/${project.id}`;
  const remoteBranches = await projectRemoteBranches(project);
  const iconUrl = findProjectIcon(project.slug)
    ? projectIconUrl(project.id, project.last_commit_sha)
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <ProjectProgressProvider
        id={project.id}
        initialStatus={project.status}
        initialLine={busy ? getProgressLine(project.id).line : ""}
        initialPercent={
          busy
            ? getProgressLine(project.id).percent
            : project.status === "running" || project.status === "error"
              ? 100
              : 0
        }
        initialError={project.last_error}
      >
      <div className="bg-background">
        <header className="flex items-baseline justify-between gap-6 px-6 py-5 md:px-10">
          {admin ? (
            <Link href="/" className="text-sm text-[var(--mute)] hover:text-[var(--ink)]">
              全部项目
            </Link>
          ) : (
            <span className="text-sm text-[var(--mute)]">vvDeploy</span>
          )}
          <LiveStatus />
        </header>

        <section className="mx-auto w-full max-w-3xl px-6 pb-4 md:px-10">
          <div className="card overflow-hidden rounded-lg">
          <div className="p-5">
          <RepoCard
            project={project}
            host={host}
            origin={host.includes(".") ? origin : undefined}
            iconUrl={iconUrl}
            titleAs="h1"
            gitUrl
            trailing={
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <ActionForm action={deployProjectAction}>
                  <input type="hidden" name="id" value={project.id} />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={busy}
                    title="拉取并部署"
                    aria-label="拉取并部署"
                  >
                    <RocketIcon />
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
          <ErrorToast message={remoteBranches.error} />
          {!host.includes(".") && !config.domainSuffixes.length ? (
            <p className="mt-4 text-sm text-[var(--busy)]">
              还没有域名，请填写完整主机名，或让管理员先在设置里填写后缀。
            </p>
          ) : null}
          <ActionForm
            action={saveProjectSettingsAction}
            className="mt-6 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="id" value={project.id} />
            <label className="flex min-w-44 flex-1 flex-col gap-1 text-xs text-[var(--mute)]">
              域名
              <Input
                name="custom_domain"
                defaultValue={host}
                placeholder={
                  domainSuffix ? `${project.slug}.${domainSuffix}` : "app.example.com"
                }
                className="w-full font-mono"
                disabled={busy}
              />
            </label>
            {config.domainSuffixes.length > 0 ? (
              <input type="hidden" name="domain_suffix" value={domainSuffix} />
            ) : null}
            <label className="flex min-w-36 flex-1 flex-col gap-1 text-xs text-[var(--mute)]">
              分支
              <NativeSelect
                name="branch"
                defaultValue={project.branch}
                className="w-full font-mono"
                disabled={busy}
              >
                {remoteBranches.branches.map((name) => (
                  <NativeSelectOption key={name} value={name}>
                    {name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label className="flex min-w-36 flex-1 flex-col gap-1 text-xs text-[var(--mute)]">
              入口
              <NativeSelect
                name="expose_service"
                defaultValue={project.expose_service ?? ""}
                className="w-full font-mono"
              >
                <NativeSelectOption value="">自动选择</NativeSelectOption>
                {serviceNames.map((name) => (
                  <NativeSelectOption key={name} value={name}>
                    {name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs text-[var(--mute)]">
              端口
              <Input
                name="expose_port"
                type="number"
                defaultValue={project.expose_port ?? ""}
                placeholder="端口"
              />
            </label>
            <Button type="submit" className="shrink-0" disabled={busy}>
              保存
            </Button>
          </ActionForm>
              </>
            }
          />
          </div>
          <DeployTicker
            name={project.name}
            gitUrl={project.git_url}
            branch={project.branch}
          />
          </div>
        </section>
      </div>
      </ProjectProgressProvider>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 pt-4 pb-10 md:px-10">
        <section>
          <h2 className="text-sm text-[var(--mute)]">环境变量</h2>
          <p className="mt-1 text-sm leading-7 text-[var(--mute)]">
            每个服务启动时都能读到，compose 里的{" "}
            <span className="font-mono">{"${NAME}"}</span>{" "}
            也会被替换。可粘贴或导入 .env，保存后重新部署才生效。
          </p>
          <EnvForm
            key={project.updated_at}
            id={project.id}
            initialText={dumpDotenv(parseEnvJson(project.env_vars))}
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
            会停掉容器并去掉面板记录。repos 与 volumes 仍留在磁盘。输入{" "}
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
      </main>
    </div>
  );
}
