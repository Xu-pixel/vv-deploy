"use client";

import { SkeletonSwap } from "./interior/skeleton-swap";
import { StatusDot } from "./status-dot";
import { useProjectProgress } from "./project-progress";

export function LiveStatus() {
  const { status, ready, stale } = useProjectProgress();
  return <div className="w-28" title={stale ? "连接中，显示上次状态" : undefined}><SkeletonSwap ready={ready} reserve={22} lines={1} label="加载状态"><span className="flex items-center gap-1"><StatusDot status={status} />{stale && <span className="text-xs text-muted-foreground">待更新</span>}</span></SkeletonSwap></div>;
}
