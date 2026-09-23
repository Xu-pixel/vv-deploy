"use client";

import { useEffect, useRef, useState } from "react";
import { formatWhen } from "@/lib/format";
import type { DeployRun } from "@/lib/db/types";
import { isLiveBusy, useProjectProgress } from "./project-progress";

const label: Record<DeployRun["status"], string> = {
  running: "进行中",
  success: "成功",
  error: "失败",
  cancelled: "已取消",
};

const tone: Record<DeployRun["status"], string> = {
  running: "text-[var(--busy)]",
  success: "text-[var(--run)]",
  error: "text-[var(--err)]",
  cancelled: "text-[var(--mute)]",
};

function spanLabel(start: string, end: string | null): string {
  if (!end) return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} 秒`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) return seconds ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${minutes % 60} 分`;
}

export function DeployHistory({
  id,
  initial,
}: {
  id: string;
  initial: DeployRun[];
}) {
  const snap = useProjectProgress();
  const [rows, setRows] = useState(initial);
  const [picked, setPicked] = useState<string | null>(null);
  const [body, setBody] = useState<{ text: string; truncated: boolean } | null>(null);
  const box = useRef<HTMLPreElement>(null);
  const activeId = picked ?? rows[0]?.id ?? null;
  const active = rows.find((row) => row.id === activeId) ?? null;

  useEffect(() => {
    let stop = false;
    const pull = async () => {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}/deploys`);
      if (!res.ok || stop) return;
      setRows((await res.json()) as DeployRun[]);
    };
    void pull();
    if (!isLiveBusy(snap.status)) {
      return () => {
        stop = true;
      };
    }
    const timer = window.setInterval(() => void pull(), 2000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [id, snap.status]);

  useEffect(() => {
    if (!activeId) {
      setBody(null);
      return;
    }
    let stop = false;
    const pull = async () => {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(id)}/deploys/${encodeURIComponent(activeId)}`,
      );
      if (stop) return;
      if (!res.ok) {
        setBody({ text: "找不到这次部署的日志。", truncated: false });
        return;
      }
      const data = (await res.json()) as { text: string; truncated: boolean };
      setBody({ text: data.text, truncated: data.truncated });
    };
    void pull();
    if (active?.status !== "running") {
      return () => {
        stop = true;
      };
    }
    const timer = window.setInterval(() => void pull(), 2000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [id, activeId, active?.status]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollTop = active?.status === "running" ? el.scrollHeight : 0;
  }, [body?.text, activeId, active?.status]);

  return (
    <section>
      <h2 className="text-sm text-[var(--mute)]">部署记录</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--mute)]">还没有部署记录。</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--card)]">
          <ul>
            {rows.map((row) => {
              const selected = row.id === activeId;
              return (
                <li key={row.id} className="border-b border-[var(--line)] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setPicked(row.id)}
                    aria-current={selected ? "true" : undefined}
                    className={`flex w-full items-baseline justify-between gap-4 px-4 py-2.5 text-left text-sm ${selected ? "bg-[#eef0f3]" : ""}`}
                  >
                    <span className="font-mono text-xs">{formatWhen(row.started_at)}</span>
                    <span className={`text-xs ${tone[row.status]}`}>{label[row.status]}</span>
                    <span className="ml-auto text-xs text-[var(--mute)]">
                      {spanLabel(row.started_at, row.finished_at)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {body?.truncated ? (
            <p className="border-t border-[var(--line)] px-4 py-2 text-xs text-[var(--mute)]">
              日志较长，只显示末尾。
            </p>
          ) : null}
          <pre ref={box} className="log-pane rounded-none">
            {body == null
              ? "加载中…"
              : body.text || (active?.status === "running" ? "等待输出…" : "这次部署没有日志。")}
          </pre>
        </div>
      )}
    </section>
  );
}
