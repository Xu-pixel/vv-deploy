import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findProjectIcon } from "./project-icon";

test("prefers icon.png over public/logo.png", () => {
  const root = mkdtempSync(join(tmpdir(), "vv-icon-"));
  const prev = process.env.VV_ROOT;
  process.env.VV_ROOT = root;
  try {
    const repo = join(root, "repos", "shop");
    mkdirSync(join(repo, "app"), { recursive: true });
    mkdirSync(join(repo, "public"), { recursive: true });
    writeFileSync(join(repo, "public", "logo.png"), "logo");
    writeFileSync(join(repo, "app", "icon.png"), "icon");
    const found = findProjectIcon("shop");
    expect(found?.path).toBe(realpathSync(join(repo, "app", "icon.png")));
    expect(found?.mime).toBe("image/png");
  } finally {
    process.env.VV_ROOT = prev;
    rmSync(root, { recursive: true, force: true });
  }
});

test("returns null when the repo has no icon", () => {
  const root = mkdtempSync(join(tmpdir(), "vv-icon-"));
  const prev = process.env.VV_ROOT;
  process.env.VV_ROOT = root;
  try {
    mkdirSync(join(root, "repos", "empty"), { recursive: true });
    expect(findProjectIcon("empty")).toBe(null);
    expect(findProjectIcon("missing")).toBe(null);
  } finally {
    process.env.VV_ROOT = prev;
    rmSync(root, { recursive: true, force: true });
  }
});
