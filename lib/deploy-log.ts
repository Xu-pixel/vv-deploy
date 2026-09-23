import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readSync,
  rmSync,
  appendFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { Database } from "bun:sqlite";
import { projectRoot } from "./paths";

const ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const READ_MAX = 1_500_000;

export function deployLogsDir(): string {
  return join(projectRoot(), "data", "deploy-logs");
}

export function cleanLogChunk(text: string): string {
  return text
    .replace(/\u0004/g, "")
    .replace(/\u001b\[\??[0-9;]*[A-Za-z]/g, "")
    .replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function deployLogFile(projectId: string, deployId: string): string {
  if (!ID_RE.test(projectId) || !ID_RE.test(deployId)) {
    throw new Error("部署日志路径不合法");
  }
  return join(deployLogsDir(), projectId, `${deployId}.log`);
}

export function appendDeployLog(projectId: string, deployId: string, text: string): void {
  const cleaned = cleanLogChunk(text);
  if (!cleaned) return;
  const path = deployLogFile(projectId, deployId);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, cleaned);
}

export function readDeployLog(
  projectId: string,
  deployId: string,
  maxBytes = READ_MAX,
): { text: string; truncated: boolean } {
  const path = deployLogFile(projectId, deployId);
  if (!existsSync(path)) return { text: "", truncated: false };
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    const start = size > maxBytes ? size - maxBytes : 0;
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    let text = buf.toString("utf8");
    if (start > 0) {
      const nl = text.indexOf("\n");
      const rest = nl >= 0 ? text.slice(nl + 1) : "";
      if (rest) text = rest;
    }
    return { text, truncated: start > 0 };
  } finally {
    closeSync(fd);
  }
}

/** Copy log_text out to files before migration 004 drops that column. */
export function spillLegacyDeployLogs(db: Database): void {
  const names = db
    .query<{ name: string }, []>("PRAGMA table_info(deploy_logs)")
    .all()
    .map((col) => col.name);
  if (!names.includes("log_text")) return;
  const rows = db
    .query<{ id: string; project_id: string; log_text: string }, []>(
      "SELECT id, project_id, log_text FROM deploy_logs WHERE log_text != ''",
    )
    .all();
  for (const row of rows) {
    const path = deployLogFile(row.project_id, row.id);
    if (existsSync(path)) continue;
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, row.log_text.endsWith("\n") ? row.log_text : `${row.log_text}\n`);
  }
}

export function removeProjectDeployLogs(projectId: string): void {
  if (!ID_RE.test(projectId)) return;
  const dir = join(deployLogsDir(), projectId);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
