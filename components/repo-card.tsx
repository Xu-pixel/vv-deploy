import type { ReactNode } from "react";
import {
  ClockIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  GlobeIcon,
  UserIcon,
} from "lucide-react";
import { formatWhen, shortSha } from "@/lib/format";
import type { Project } from "@/lib/db/types";

export function RepoCard({
  project,
  host,
  origin,
  iconUrl,
  titleAs = "h2",
  gitUrl = false,
  trailing,
  footer,
}: {
  project: Project;
  host: string;
  origin?: string;
  iconUrl?: string | null;
  titleAs?: "h1" | "h2";
  gitUrl?: boolean;
  trailing?: ReactNode;
  footer?: ReactNode;
}) {
  const Title = titleAs;
  const message = project.last_commit_message?.trim() || "";
  const hostInner = origin ? (
    <a
      href={origin}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-[var(--ink)] hover:underline"
    >
      {host}
    </a>
  ) : (
    <span className="truncate">{host}</span>
  );

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              className={
                titleAs === "h1"
                  ? "size-10 shrink-0 rounded-md object-contain"
                  : "size-8 shrink-0 rounded-md object-contain"
              }
            />
          ) : null}
          <Title
            className={
              titleAs === "h1"
                ? "min-w-0 truncate text-3xl leading-tight tracking-tight"
                : "min-w-0 truncate text-lg leading-tight tracking-tight"
            }
          >
            {project.name}
          </Title>
        </div>
        {trailing}
      </div>
      <p
        className={
          titleAs === "h1"
            ? "mt-3 flex items-center gap-1.5 font-mono text-sm text-[var(--mute)]"
            : "mt-2 flex items-center gap-1.5 font-mono text-xs text-[var(--mute)]"
        }
      >
        <GlobeIcon className="size-3.5 shrink-0" />
        {hostInner}
      </p>
      {gitUrl ? (
        <p className="mt-1 font-mono text-xs text-[var(--mute)]">{project.git_url}</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--card)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
            <GitBranchIcon className="size-3" />
            {project.branch}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-[var(--mute)]">
            <GitCommitHorizontalIcon className="size-3" />
            {shortSha(project.last_commit_sha)}
          </span>
          {titleAs === "h1" ? (
            <span className="text-sm text-[var(--ink)]">{message || "尚无提交"}</span>
          ) : null}
        </div>
        {titleAs === "h2" ? (
          <p className="truncate text-sm text-[var(--ink)]" title={message || undefined}>
            {message || "(空)"}
          </p>
        ) : null}
        <p className="flex flex-wrap items-center gap-3 text-xs text-[var(--mute)]">
          {project.last_commit_author ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <UserIcon className="size-3 shrink-0" />
              <span className="truncate">{project.last_commit_author}</span>
            </span>
          ) : null}
          <span className="inline-flex shrink-0 items-center gap-1">
            <ClockIcon className="size-3" />
            {formatWhen(
              project.last_commit_at ?? project.last_deployed_at ?? project.updated_at,
            )}
          </span>
        </p>
      </div>
      {footer}
    </>
  );
}
