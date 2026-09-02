"use client";

import { useEffect, useRef, useState } from "react";
import { AskAiButtons, buildAskPrompt } from "@/components/ask-ai";
import { toastProjectError } from "./error-toast";
import { isLiveBusy, useProjectProgress } from "./project-progress";
import { statusLabel } from "@/lib/format";

function prefersReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function tone(status: string): "busy" | "run" | "err" | "idle" {
  if (status === "running") return "run";
  if (isLiveBusy(status)) return "busy";
  if (status === "error") return "err";
  return "idle";
}

function targetPercent(status: string, raw: number | null): number {
  if (status === "running") return 100;
  if (status === "error") return 100;
  if (isLiveBusy(status)) return raw == null ? 12 : Math.max(4, Math.min(100, raw));
  return 0;
}

function playLine(containers: string[]): string {
  return containers.length ? containers.join("   ") : "…";
}

function restLine(status: string, containers: string[] = []): string {
  if (status === "running") return playLine(containers);
  if (status === "error") return "部署失败";
  if (status === "cloning" || status === "building") return "启动中…";
  return "";
}

export function DeployTicker({
  name,
  gitUrl,
  branch,
}: {
  name: string;
  gitUrl: string;
  branch: string;
}) {
  const snap = useProjectProgress();
  const [current, setCurrent] = useState(
    snap.status === "running" ? playLine(snap.containers) : snap.line || restLine(snap.status),
  );
  const [incoming, setIncoming] = useState<string | null>(null);
  const [hold, setHold] = useState(false);
  const [shownPercent, setShownPercent] = useState(() =>
    targetPercent(snap.status, snap.percent),
  );
  const prevStatus = useRef(snap.status);
  const currentRef = useRef(
    snap.status === "running" ? playLine(snap.containers) : snap.line || restLine(snap.status),
  );
  const incomingRef = useRef<string | null>(null);
  const rolling = useRef(false);
  const queued = useRef<string | null>(null);
  const holding = useRef(false);
  const rollTimer = useRef(0);
  const containersRef = useRef(snap.containers);
  const shownRef = useRef(shownPercent);
  containersRef.current = snap.containers;

  const clearRollTimer = () => {
    if (rollTimer.current) {
      window.clearTimeout(rollTimer.current);
      rollTimer.current = 0;
    }
  };

  const releaseHold = () => {
    holding.current = false;
    setHold(false);
  };

  const show = (line: string) => {
    if (!line || line === currentRef.current) return;
    if (prefersReduced() || !currentRef.current) {
      clearRollTimer();
      currentRef.current = line;
      incomingRef.current = null;
      rolling.current = false;
      queued.current = null;
      setCurrent(line);
      setIncoming(null);
      return;
    }
    if (rolling.current) {
      queued.current = line;
      return;
    }
    rolling.current = true;
    incomingRef.current = line;
    setIncoming(line);
    clearRollTimer();
    rollTimer.current = window.setTimeout(() => onRolled(), 320);
  };

  const onRolled = () => {
    clearRollTimer();
    const landed = incomingRef.current ?? currentRef.current;
    currentRef.current = landed;
    incomingRef.current = null;
    rolling.current = false;
    setCurrent(landed);
    setIncoming(null);
    if (queued.current && queued.current !== landed) {
      const next = queued.current;
      queued.current = null;
      show(next);
    } else {
      queued.current = null;
    }
  };

  useEffect(() => {
    const was = prevStatus.current;
    if (was !== "error" && snap.status === "error") {
      const reason = (snap.error || snap.line || "").trim();
      if (reason) toastProjectError(snap.id, reason);
    }

    if (isLiveBusy(snap.status)) {
      if (holding.current) releaseHold();
      if (!isLiveBusy(was)) {
        shownRef.current = snap.percent ?? 4;
        setShownPercent(shownRef.current);
      }
      if (snap.line) show(snap.line);
      prevStatus.current = snap.status;
      return;
    }

    if (snap.status === "running") {
      if (isLiveBusy(was)) {
        holding.current = true;
        setHold(true);
        show(snap.line || "已启动");
      } else if (!holding.current) {
        show(restLine(snap.status, snap.containers));
      }
      prevStatus.current = snap.status;
      return;
    }

    releaseHold();
    show(restLine(snap.status, snap.containers));
    prevStatus.current = snap.status;
  }, [snap.status, snap.line, snap.error, snap.containers]);

  useEffect(() => {
    if (!hold) return;
    const timer = window.setTimeout(() => {
      holding.current = false;
      setHold(false);
      show(playLine(containersRef.current));
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [hold]);

  const goal = targetPercent(snap.status, snap.percent);

  useEffect(() => {
    if (prefersReduced()) {
      shownRef.current = goal;
      setShownPercent(goal);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      const cur = shownRef.current;
      const next = cur + (goal - cur) * (1 - Math.exp(-dt / 220));
      const landed = Math.abs(next - goal) < 0.2 ? goal : next;
      shownRef.current = landed;
      setShownPercent(landed);
      if (landed !== goal) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [goal]);

  const kind = tone(snap.status);
  const percent = Math.round(shownPercent);
  const label = statusLabel[snap.status] ?? snap.status;
  const line = current || restLine(snap.status, snap.containers);
  const nextLine = incoming ?? line;
  const isRolling = Boolean(incoming);
  const reelKey = incoming ? `in:${incoming}` : `cur:${current}`;
  const fill = Math.max(0, Math.min(100, shownPercent));
  const showFill = fill > 0.4;
  const isFull = kind === "run" || kind === "err" || fill >= 99.5;
  const errorText = (snap.error || "").trim() || (kind === "err" ? line : "");
  const askPrompt =
    kind === "err" && errorText
      ? buildAskPrompt({ name, gitUrl, branch, error: errorText })
      : "";

  return (
    <div
      className={`deploy-progress is-${kind}`}
      role="status"
      aria-live="polite"
      aria-label={`${label} ${percent}% ${line}`}
    >
      <div
        className={`deploy-pill is-${kind}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="deploy-pill-track">
          <PillRow
            reelKey={reelKey}
            rolling={isRolling}
            label={label}
            line={line}
            nextLine={nextLine}
            hasAsk={Boolean(askPrompt)}
            onRolled={onRolled}
          />
          {showFill ? (
            <div
              className={isFull ? "deploy-pill-fill is-full" : "deploy-pill-fill"}
              style={isFull ? { width: "100%" } : { width: `${fill}%` }}
            >
              <PillRow
                reelKey={reelKey}
                rolling={isRolling}
                label={label}
                line={line}
                nextLine={nextLine}
                hasAsk={Boolean(askPrompt)}
              />
              {askPrompt ? null : <span className="deploy-pill-cursor" aria-hidden />}
            </div>
          ) : (
            <span className="deploy-pill-tick" aria-hidden />
          )}
          {askPrompt ? <AskAiButtons prompt={askPrompt} /> : null}
        </div>
      </div>
    </div>
  );
}

function PillRow({
  reelKey,
  rolling,
  label,
  line,
  nextLine,
  hasAsk,
  onRolled,
}: {
  reelKey: string;
  rolling: boolean;
  label: string;
  line: string;
  nextLine: string;
  hasAsk?: boolean;
  onRolled?: () => void;
}) {
  return (
    <div className={hasAsk ? "deploy-pill-row has-ask" : "deploy-pill-row"}>
      <span className="deploy-pill-label">{label}</span>
      <div className="deploy-pill-reel">
        <div
          key={reelKey}
          className={rolling ? "deploy-reel-track is-rolling" : "deploy-reel-track"}
          onAnimationEnd={onRolled}
        >
          <div className="deploy-reel-line">{line}</div>
          <div className="deploy-reel-line">{nextLine}</div>
        </div>
      </div>
    </div>
  );
}
