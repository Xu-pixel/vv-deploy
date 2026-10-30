"use client";

import { TaskSteps } from "@/components/interior/task-steps";
import { CopyButton } from "@/components/copy-button";
import { useProjectProgress } from "./project-progress";
import { statusLabel } from "@/lib/format";
import { deployStep } from "@/lib/deploy-steps";

const steps = [
  { id: "sync", label: "同步仓库" },
  { id: "config", label: "准备环境配置" },
  { id: "compose", label: "构建镜像并启动服务" },
];

export function DeployTicker() {
  const snap = useProjectProgress();
  const current = deployStep(snap.status, snap.percent);
  const failed = snap.status === "error";
  const error = snap.error?.trim() || (failed ? "部署失败，请查看部署日志。" : "");
  const summary = snap.status === "running"
    ? "部署完成，服务运行中"
    : failed && current < 0
      ? "部署失败，具体阶段请查看日志"
      : snap.status === "building" && current < 0
        ? "正在获取部署进度…"
        : statusLabel[snap.status] ?? snap.status;

  return (
    <section className="deployment-steps" aria-label="部署进度">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium">部署步骤</h2>
        <span className="text-xs text-muted-foreground" role="status">{summary}</span>
      </div>
      <TaskSteps steps={steps} current={current} failed={failed} label="部署步骤" />
      {snap.line && (snap.status === "building" || snap.status === "cloning") ? (
        <p className="mt-3 truncate font-mono text-xs text-muted-foreground" title={snap.line}>{snap.line}</p>
      ) : null}
      {snap.status === "running" && snap.containers.length > 0 ? (
        <p className="mt-3 break-words font-mono text-xs text-muted-foreground">{snap.containers.join(" · ")}</p>
      ) : null}
      {failed ? (
        <div className="task-step-error mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-xs text-destructive" title={error}>{error}</p>
          <CopyButton value={error} label="复制报错" className="shrink-0" />
        </div>
      ) : null}
    </section>
  );
}
