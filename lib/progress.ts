import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "./paths";

export type ProgressSnap = {
  line: string;
  seq: number;
  percent: number | null;
};

function ratio(done: number, total: number, lo: number, hi: number): number {
  if (total <= 0) return lo;
  const t = Math.min(1, Math.max(0, done / total));
  return Math.round(lo + (hi - lo) * t);
}

/** Overall compose/BuildKit progress. Prefers `[+] Building (n/m)`, not per-stage `[runner 6/6]`. */
export function parseComposePercent(text: string): number | null {
  let best: number | null = null;
  const consider = (done: number, total: number, lo: number, hi: number) => {
    if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0 || done < 0) return;
    const next = ratio(done, total, lo, hi);
    if (best == null || next > best) best = next;
  };

  for (const match of text.matchAll(
    /\[\+\]\s+Building\b[^\n]*?(\d+)\s*\/\s*(\d+)/gi,
  )) {
    consider(Number(match[1]), Number(match[2]), 15, 90);
  }
  for (const match of text.matchAll(/\[\+\]\s+Running\s+(\d+)\s*\/\s*(\d+)/gi)) {
    consider(Number(match[1]), Number(match[2]), 90, 99);
  }
  if (best != null) return best;

  let vertex = 0;
  for (const match of text.matchAll(/(?:^|[\s])#(\d+)\b/g)) {
    vertex = Math.max(vertex, Number(match[1]));
  }
  if (vertex >= 2) consider(vertex, vertex + 3, 15, 85);
  return best;
}

function higherPercent(
  prev: number | null,
  ...cands: Array<number | null | undefined>
): number | null {
  let best = prev;
  for (const cand of cands) {
    if (cand == null || !Number.isFinite(cand)) continue;
    const clamped = Math.min(100, Math.max(0, cand));
    if (best == null || clamped > best) best = clamped;
  }
  return best;
}

const STORE_KEY = "__vvProgress";
const HUB_KEY = "__vvProgressHub";

type Store = Map<string, ProgressSnap>;

function store(): Store {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: Store };
  g[STORE_KEY] ??= new Map();
  return g[STORE_KEY];
}

type Hub = Map<string, Set<() => void>>;

function hub(): Hub {
  const g = globalThis as typeof globalThis & { [HUB_KEY]?: Hub };
  g[HUB_KEY] ??= new Map();
  return g[HUB_KEY];
}

const NOTIFY_MS = 300;
const notifyAt = new Map<string, number>();
const notifyTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emitProgress(id: string): void {
  notifyAt.set(id, Date.now());
  for (const fn of hub().get(id) ?? []) fn();
}

export function subscribeProgress(id: string, fn: () => void): () => void {
  const map = hub();
  let set = map.get(id);
  if (!set) {
    set = new Set();
    map.set(id, set);
  }
  set.add(fn);
  return () => {
    set.delete(fn);
    if (set.size === 0) map.delete(id);
  };
}

/** Coalesce log-line bursts; at most ~3 events/sec per project. */
export function notifyProgress(id: string): void {
  const now = Date.now();
  const last = notifyAt.get(id) ?? 0;
  const wait = NOTIFY_MS - (now - last);
  if (wait <= 0) {
    const timer = notifyTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      notifyTimers.delete(id);
    }
    emitProgress(id);
    return;
  }
  if (notifyTimers.has(id)) return;
  notifyTimers.set(
    id,
    setTimeout(() => {
      notifyTimers.delete(id);
      emitProgress(id);
    }, wait),
  );
}

export function flushProgress(id: string): void {
  const timer = notifyTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    notifyTimers.delete(id);
  }
  emitProgress(id);
}

function dir(): string {
  return join(projectRoot(), "data", "progress");
}

function fileOf(id: string): string {
  return join(dir(), id);
}

function usableId(id: string): boolean {
  return /^[a-f0-9]{16,}$/i.test(id);
}

function cleanLine(raw: string): string {
  return raw
    .replace(/\u0004/g, "")
    .replace(/\u001b\[\??[0-9;]*[A-Za-z]/g, "")
    .replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function setProgressLine(
  id: string,
  line: string,
  percent?: number | null,
): void {
  if (!usableId(id)) return;
  const text = cleanLine(line);
  if (!text) return;
  const prev = store().get(id);
  const next: ProgressSnap = {
    line: text,
    seq: (prev?.seq ?? 0) + 1,
    percent: higherPercent(prev?.percent ?? null, percent, parseComposePercent(text)),
  };
  store().set(id, next);
  mkdirSync(dir(), { recursive: true });
  writeFileSync(fileOf(id), JSON.stringify(next), "utf8");
  notifyProgress(id);
}

export function getProgressLine(id: string): ProgressSnap {
  const mem = store().get(id);
  if (mem) return mem;
  if (!usableId(id)) return { line: "", seq: 0, percent: null };
  const path = fileOf(id);
  if (!existsSync(path)) return { line: "", seq: 0, percent: null };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as ProgressSnap;
    if (typeof parsed.line === "string" && Number.isFinite(parsed.seq)) {
      return {
        line: parsed.line,
        seq: parsed.seq,
        percent:
          typeof parsed.percent === "number" && Number.isFinite(parsed.percent)
            ? parsed.percent
            : null,
      };
    }
  } catch {
    /* stale file */
  }
  return { line: "", seq: 0, percent: null };
}

export function clearProgress(id: string): void {
  store().delete(id);
  if (usableId(id)) {
    const path = fileOf(id);
    if (existsSync(path)) rmSync(path);
  }
  flushProgress(id);
}

export type ProgressEvent = {
  status: string;
  line?: string;
  percent?: number;
  error?: string;
  containers?: string[];
};

export function progressEvent(opts: {
  status: string;
  line: string;
  percent: number | null;
  error: string | null;
  containers: string[];
}): ProgressEvent {
  const { status } = opts;
  const event: ProgressEvent = { status };
  if (status === "cloning" || status === "building") {
    if (opts.line) event.line = opts.line;
    if (opts.percent != null) event.percent = opts.percent;
  }
  if (status === "error") {
    const reason = (opts.error || opts.line || "").trim();
    if (reason) event.error = reason.slice(-4000);
  }
  if (status === "running" && opts.containers.length > 0) {
    event.containers = opts.containers;
  }
  return event;
}

export function progressSink(id: string): (chunk: string) => void {
  let leftover = "";
  return (chunk: string) => {
    leftover += chunk;
    leftover = leftover.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const parts = leftover.split("\n");
    leftover = parts.pop() ?? "";
    for (const part of parts) {
      const line = cleanLine(part);
      if (line) setProgressLine(id, line);
    }
    const current = cleanLine(leftover);
    if (current) setProgressLine(id, current);
  };
}
