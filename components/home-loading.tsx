"use client";

import { SkeletonSwap } from "./interior/skeleton-swap";
import { Input } from "./ui/input";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-muted ${className}`} />;
}

export function HomeLoading() {
  return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-20 md:px-10" aria-busy="true" aria-label="正在加载项目工作台">
        <div className="workspace-intro">
          <h1>项目工作台</h1>
          <p>连接仓库，部署应用。在这里掌握每个项目的进展。</p>
        </div>
        <div className="project-toolbar">
          <div className="eyebrow flex items-center gap-2">全部项目 · <Bar className="h-3 w-8" /></div>
          <div className="project-search"><Input disabled placeholder="搜索仓库、域名" aria-label="搜索项目、仓库或域名" /></div>
        </div>
        <ul className="project-grid grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index}>
              <div className="card project-card flex h-full flex-col rounded-lg p-5">
                <SkeletonSwap ready={false} delay={0} reserve={149} skeleton={
                  <div>
                    <div className="flex h-8 items-center justify-between gap-3"><Bar className="h-4 w-3/5" /><Bar className="h-3 w-12" /></div>
                    <div className="mt-2 flex h-4 items-center"><Bar className="h-3 w-3/4" /></div>
                    <div className="mt-4 flex flex-col gap-2">
                      <div className="flex h-[23px] items-center gap-2"><Bar className="h-5 w-14" /><Bar className="h-3 w-14" /></div>
                      <div className="flex h-5 items-center"><Bar className="h-3 w-full" /></div>
                      <div className="flex h-4 items-center gap-3"><Bar className="h-3 w-12" /><Bar className="h-3 w-20" /></div>
                    </div>
                  </div>
                }><span /></SkeletonSwap>
              </div>
            </li>
          ))}
        </ul>
        <span className="sr-only" role="status">正在加载项目列表</span>
      </main>
  );
}
