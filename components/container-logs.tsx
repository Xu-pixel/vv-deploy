"use client";

import { useEffect, useRef, useState } from "react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const TAILS = [50, 100, 200];

export function ContainerLogs({
  id,
  services,
}: {
  id: string;
  services: string[];
}) {
  const [service, setService] = useState("");
  const [tail, setTail] = useState(100);
  const [paused, setPaused] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState("连接中…");
  const box = useRef<HTMLPreElement>(null);

  useEffect(() => {
    setLines([]);
    setStatus("连接中…");
    const params = new URLSearchParams({ tail: String(tail) });
    if (service) params.set("service", service);
    const source = new EventSource(`/api/projects/${id}/logs?${params}`);
    source.onopen = () => setStatus("实时");
    source.onmessage = (event) => {
      let line: string;
      try {
        line = String(JSON.parse(event.data));
      } catch {
        line = event.data;
      }
      setLines((prev) => {
        const next = prev.length >= tail ? prev.slice(prev.length - tail + 1) : prev.slice();
        next.push(line);
        return next;
      });
    };
    source.onerror = () => setStatus("重连中…");
    return () => source.close();
  }, [id, service, tail]);

  useEffect(() => {
    if (paused) return;
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, paused]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-[var(--mute)]">{status}</span>
        <label className="flex items-center gap-2 text-[var(--mute)]">
          服务
          <NativeSelect
            size="sm"
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <NativeSelectOption value="">全部</NativeSelectOption>
            {services.map((name) => (
              <NativeSelectOption key={name} value={name}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="flex items-center gap-2 text-[var(--mute)]">
          保留
          <NativeSelect
            size="sm"
            value={tail}
            onChange={(e) => setTail(Number(e.target.value))}
          >
            {TAILS.map((n) => (
              <NativeSelectOption key={n} value={n}>
                {n} 行
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <button type="button" className="ghost" onClick={() => setPaused((v) => !v)}>
          {paused ? "继续滚动" : "暂停"}
        </button>
      </div>
      <pre ref={box} className="log-pane log-pane-live">
        {lines.length ? lines.join("\n") : "等待容器输出…"}
      </pre>
    </div>
  );
}
