"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { toastProjectError } from "./error-toast";

export type ProgressSnap = {
  id: string;
  status: string;
  alive: boolean;
  error: string | null;
  line: string;
  seq: number;
  percent: number | null;
  containers: string[];
};

const Ctx = createContext<ProgressSnap | null>(null);

export function isLiveBusy(status: string): boolean {
  return status === "cloning" || status === "building";
}

export function useProjectProgress(): ProgressSnap {
  const snap = useContext(Ctx);
  if (!snap) {
    throw new Error("useProjectProgress 需要 ProjectProgressProvider");
  }
  return snap;
}

function ProgressErrorWatcher() {
  const snap = useProjectProgress();
  const prevStatus = useRef(snap.status);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = snap.status;
    if (snap.status === "error") {
      const reason = (snap.error || snap.line || "").trim();
      if (reason) toastProjectError(snap.id, reason);
      return;
    }
    if (isLiveBusy(was) && snap.status === "running") {
      toast.add({ type: "success", title: "部署成功" });
    }
  }, [snap.id, snap.status, snap.error, snap.line, snap.seq]);
  return null;
}

export function ProjectProgressProvider({
  id,
  initialStatus,
  initialLine = "",
  initialPercent = null,
  initialError = null,
  children,
}: {
  id: string;
  initialStatus: string;
  initialLine?: string;
  initialPercent?: number | null;
  initialError?: string | null;
  children: React.ReactNode;
}) {
  const [snap, setSnap] = useState<ProgressSnap>({
    id,
    status: initialStatus,
    alive: isLiveBusy(initialStatus),
    error: initialError,
    line: initialLine,
    seq: 0,
    percent: initialPercent,
    containers: [],
  });

  useEffect(() => {
    const source = new EventSource(`/api/projects/${id}/progress`);
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ProgressSnap;
        setSnap({
          ...data,
          id,
          alive: data.alive === true,
          containers: data.containers ?? [],
        });
      } catch {
        /* ignore */
      }
    };
    return () => source.close();
  }, [id]);

  return (
    <Ctx.Provider value={snap}>
      <ProgressErrorWatcher />
      {children}
    </Ctx.Provider>
  );
}
