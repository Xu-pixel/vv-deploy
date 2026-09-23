import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import {
  appendDeployLog,
  cleanLogChunk,
  deployLogFile,
  readDeployLog,
  removeProjectDeployLogs,
  spillLegacyDeployLogs,
} from "./deploy-log";

const projectId = "AbcdEfgh1234";
const deployId = "a".repeat(32);
let root = "";
let previous: string | undefined;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = "";
  if (previous === undefined) delete process.env.VV_ROOT;
  else process.env.VV_ROOT = previous;
});

function useTempRoot(): void {
  previous = process.env.VV_ROOT;
  root = mkdtempSync(join(tmpdir(), "vv-deploy-log-"));
  process.env.VV_ROOT = root;
}

test("strips ansi and keeps carriage-return rewrites as new lines", () => {
  expect(cleanLogChunk("a\u001b[2K\r\u001b[1Ab\r\n")).toBe("a\nb\n");
});

test("rejects a path that leaves the log directory", () => {
  expect(() => deployLogFile("../etc", deployId)).toThrow("部署日志路径不合法");
  expect(() => deployLogFile(projectId, "a/../../x")).toThrow("部署日志路径不合法");
});

test("writes and reads a deploy log file", () => {
  useTempRoot();
  appendDeployLog(projectId, deployId, "clone\n");
  appendDeployLog(projectId, deployId, "up --build\n");
  expect(readDeployLog(projectId, deployId)).toEqual({
    text: "clone\nup --build\n",
    truncated: false,
  });
  expect(readDeployLog(projectId, "b".repeat(32))).toEqual({ text: "", truncated: false });
});

test("returns only the tail when the file is larger than the cap", () => {
  useTempRoot();
  appendDeployLog(projectId, deployId, `keep-me\n${"x".repeat(40)}\n`);
  const read = readDeployLog(projectId, deployId, 12);
  expect(read.truncated).toBe(true);
  expect(read.text).toBe(`${"x".repeat(11)}\n`);
});

test("copies legacy log_text into a file once", () => {
  useTempRoot();
  const db = new Database(":memory:");
  db.run(`CREATE TABLE deploy_logs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    log_text TEXT NOT NULL DEFAULT ''
  )`);
  db.run(
    "INSERT INTO deploy_logs (id, project_id, started_at, status, log_text) VALUES (?, ?, ?, ?, ?)",
    [deployId, projectId, "t", "error", "hello from sqlite"],
  );
  spillLegacyDeployLogs(db);
  spillLegacyDeployLogs(db);
  expect(readDeployLog(projectId, deployId).text).toBe("hello from sqlite\n");
});

test("removes a project's log directory", () => {
  useTempRoot();
  appendDeployLog(projectId, deployId, "gone\n");
  removeProjectDeployLogs(projectId);
  expect(readDeployLog(projectId, deployId).text).toBe("");
});
