import { afterEach, expect, test } from "bun:test";
import {
  clearProgress,
  getProgressLine,
  parseComposePercent,
  progressEvent,
  progressSink,
  setProgressLine,
} from "./progress";

const id = "ab".repeat(16);

afterEach(() => {
  clearProgress(id);
});

test("sink keeps the latest visible line including cr rewrites", () => {
  const sink = progressSink(id);
  sink("Cloning into repo...\n");
  expect(getProgressLine(id).line).toBe("Cloning into repo...");
  sink("=> #1 foo\r");
  sink("=> #1 foo 2s\r");
  expect(getProgressLine(id).line).toBe("=> #1 foo 2s");
  sink("exporting to image\n");
  expect(getProgressLine(id).line).toBe("exporting to image");
});

test("overwrites the same slot instead of appending history", () => {
  setProgressLine(id, "one");
  const first = getProgressLine(id).seq;
  setProgressLine(id, "two");
  const next = getProgressLine(id);
  expect(next.line).toBe("two");
  expect(next.seq).toBe(first + 1);
});

test("parses compose and buildkit step ratios", () => {
  expect(parseComposePercent("[+] Building 23.4s (11/14)")).toBe(
    Math.round(15 + (90 - 15) * (11 / 14)),
  );
  expect(parseComposePercent("[+] Building 0.0s (0/1) [+] Building 0.1s (8/20)")).toBe(
    Math.round(15 + (90 - 15) * (8 / 20)),
  );
  expect(parseComposePercent("[+] Running 2/2")).toBe(99);
  expect(parseComposePercent("#1 [internal] load metadata")).toBeNull();
  expect(parseComposePercent("[base 2/2] WORKDIR /app")).toBeNull();
});

test("percent only moves forward", () => {
  setProgressLine(id, "[+] Building 1.0s (4/20)");
  const mid = getProgressLine(id).percent;
  setProgressLine(id, "Cloning into repo...");
  expect(getProgressLine(id).percent).toBe(mid);
  setProgressLine(id, "[+] Building 12.0s (16/20)");
  expect(getProgressLine(id).percent).toBeGreaterThan(mid ?? 0);
});

test("progressEvent drops idle fields and caps error", () => {
  expect(progressEvent({
    status: "running",
    line: "已启动",
    percent: 100,
    error: null,
    containers: ["app-1"],
  })).toEqual({ status: "running", containers: ["app-1"] });
  expect(progressEvent({
    status: "building",
    line: "exporting",
    percent: 80,
    error: "old",
    containers: [],
  })).toEqual({ status: "building", line: "exporting", percent: 80 });
  const error = progressEvent({
    status: "error",
    line: "",
    percent: null,
    error: "x".repeat(5000),
    containers: [],
  });
  expect(error.error?.length).toBe(4000);
});
