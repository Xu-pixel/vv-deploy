"use client";

import { SkeletonSwap } from "./interior/skeleton-swap";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { RepoCard } from "@/components/repo-card";
import { StatusDot } from "@/components/status-dot";
import type { Project } from "@/lib/db/types";
import type { ProjectFace } from "@/lib/project-face";

export function HomeProjects({
  projects,
  faces,
  iconById,
  initialQ,
}: {
  projects: Project[];
  faces: Record<string, ProjectFace>;
  iconById: Record<string, string>;
  initialQ: string;
}) {
  const [runtimeById, setRuntime] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 10000);
    fetch("/api/projects/runtime", { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (active) setRuntime(data); })
      .catch(() => { if (active) setRuntime({}); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, []);
  const [q, setQ] = useState(initialQ);
  const needle = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!needle) return projects;
    return projects.filter((project) => {
      const face = faces[project.id];
      return [face?.title, project.slug, face?.gitUrl, face?.branch, face?.host].some((value) =>
        value?.toLowerCase().includes(needle),
      );
    });
  }, [projects, faces, needle]);

  return (
    <>
      <div className="workspace-intro">
        <h1>项目工作台</h1>
        <p>连接仓库，部署应用。在这里掌握每个项目的进展。</p>
      </div>
      <div className="project-toolbar">
        <p className="eyebrow" aria-live="polite">全部项目 · {filtered.length} / {projects.length}</p>
      <form
        action="/"
        className="project-search"
        onSubmit={(event) => event.preventDefault()}
      >
        <Input
          name="q"
          value={q}
          placeholder="搜索仓库、域名"
          aria-label="搜索项目、仓库或域名"
          onChange={(event) => setQ(event.target.value)}
        />
      </form>
      </div>

      {projects.length === 0 ? (
        <div className="mt-20 text-[var(--mute)]">
          <p>还没有项目。</p>
          <Link href="/new" className="mt-3 inline-block ghost">
            接入一个仓库
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-20 text-[var(--mute)]">没有匹配的项目。</p>
      ) : (
        <ul className="project-grid grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => {
            const face = faces[project.id];
            if (!face) return null;
            return (
              <li key={project.id}>
                <Link
                  href={`/app/${project.id}`}
                  className="card project-card flex h-full flex-col rounded-lg p-5 transition-colors hover:bg-white"
                >
                  <RepoCard
                    project={project}
                    face={face}
                    linkHost={false}
                    iconUrl={iconById[project.id]}
                    trailing={<div className="w-24"><SkeletonSwap ready={runtimeById !== null} reserve={22} lines={1} label="加载状态"><StatusDot status={runtimeById?.[project.id] ?? project.status} />{runtimeById && !runtimeById[project.id] && <span className="text-xs text-muted-foreground">待更新</span>}</SkeletonSwap></div>}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
