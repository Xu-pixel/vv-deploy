"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { RepoCard } from "@/components/repo-card";
import { StatusDot } from "@/components/status-dot";
import { resolveProjectHost } from "@/lib/slug";
import type { Project } from "@/lib/db/types";

export function HomeProjects({
  projects,
  domainSuffixes,
  iconById,
  initialQ,
}: {
  projects: Project[];
  domainSuffixes: string[];
  iconById: Record<string, string>;
  initialQ: string;
}) {
  const [q, setQ] = useState(initialQ);
  const needle = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!needle) return projects;
    return projects.filter((project) => {
      const host = resolveProjectHost(project, domainSuffixes);
      return [project.name, project.slug, project.git_url, project.branch, host].some((value) =>
        value.toLowerCase().includes(needle),
      );
    });
  }, [projects, domainSuffixes, needle]);

  return (
    <>
      <form
        action="/"
        className="mx-auto mt-14 w-full max-w-xl"
        onSubmit={(event) => event.preventDefault()}
      >
        <Input
          name="q"
          value={q}
          placeholder="搜索仓库、域名"
          autoFocus
          onChange={(event) => setQ(event.target.value)}
        />
      </form>

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
        <ul className="mt-10 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => {
            const host = resolveProjectHost(project, domainSuffixes);
            return (
              <li key={project.id}>
                <Link
                  href={`/app/${project.id}`}
                  className="card flex h-full flex-col rounded-lg p-5 transition-colors hover:bg-white"
                >
                  <RepoCard
                    project={project}
                    host={host}
                    iconUrl={iconById[project.id]}
                    trailing={<StatusDot status={project.status} />}
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
