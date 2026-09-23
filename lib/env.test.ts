import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composeArgs } from "./docker";
import {
  dumpDotenv,
  loadProjectEnv,
  parseDotenv,
  parseEnvForm,
  parseEnvJson,
  writeProjectEnvFile,
  activeEnvPath,
} from "./env";
import { projectEnvPath, repoDir } from "./paths";

function expectError(
  result: { ok: unknown } | { error: string },
  part: string,
): void {
  if (!("error" in result)) throw new Error("expected error");
  expect(result.error).toContain(part);
}

test("parse env form", () => {
  expect(parseEnvForm(["FOO", ""], ["bar", ""])).toEqual({ ok: { FOO: "bar" } });
  expectError(parseEnvForm(["FOO-BAR"], ["1"]), "不合法");
  expectError(parseEnvForm(["FOO", "FOO"], ["a", "b"]), "重复");
  expectError(parseEnvForm([""], ["x"]), "不能为空");
  expect(parseEnvForm(["_A1"], [""])).toEqual({ ok: { _A1: "" } });
});

test("parse env json", () => {
  expect(parseEnvJson('{"FOO":"bar","skip-me":1}')).toEqual({ FOO: "bar" });
  expect(parseEnvJson("not-json")).toEqual({});
  expect(parseEnvJson(null)).toEqual({});
});

test("dump dotenv quotes special values", () => {
  expect(dumpDotenv({ A: "plain", B: "has space", C: 'say"hi', D: "" })).toBe(
    `A=plain\nB="has space"\nC="say\\"hi"\nD=""\n`,
  );
});

test("parse dotenv text", () => {
  expect(
    parseDotenv(`
# comment
export FOO=bar
BAZ="a b"
QUOTED="say\\"hi"
SINGLE='keep $raw'
EMPTY=
`),
  ).toEqual({
    ok: {
      FOO: "bar",
      BAZ: "a b",
      QUOTED: 'say"hi',
      SINGLE: "keep $raw",
      EMPTY: "",
    },
  });
  expectError(parseDotenv("FOO-BAR=1"), "不合法");
  expectError(parseDotenv("not a line"), "NAME=value");
  expect(parseDotenv("A=1\nA=2")).toEqual({ ok: { A: "2" } });
});

test("dotenv round trip", () => {
  const vars = { A: "plain", B: "has space", C: 'say"hi', D: "a$b", E: "" };
  expect(parseDotenv(dumpDotenv(vars))).toEqual({ ok: vars });
});

test("composeArgs uses repo docker-compose.deploy.yaml and .env", () => {
  const root = mkdtempSync(join(tmpdir(), "vv-env-"));
  const prevRoot = process.env.VV_ROOT;
  const prevRepos = process.env.REPOS_DIR;
  process.env.VV_ROOT = root;
  delete process.env.REPOS_DIR;
  try {
    mkdirSync(repoDir("shop"), { recursive: true });
    writeFileSync(join(repoDir("shop"), "docker-compose.deploy.yaml"), "services:\n  web:\n    image: nginx\n");
    expect(composeArgs("shop", ["up"])).not.toContain("--env-file");
    writeFileSync(projectEnvPath("shop"), "FOO=bar\n");
    chmodSync(projectEnvPath("shop"), 0o600);
    const args = composeArgs("shop", ["up"]);
    expect(args).toContain("--env-file");
    expect(args).toContain(projectEnvPath("shop"));
    expect(args).toContain("-f");
    expect(args).toContain(join(repoDir("shop"), "docker-compose.deploy.yaml"));
    expect(args).toContain("--project-directory");
    expect(args).toContain(repoDir("shop"));
    expect(readFileSync(projectEnvPath("shop"), "utf8")).toBe("FOO=bar\n");
  } finally {
    process.env.VV_ROOT = prevRoot;
    if (prevRepos === undefined) delete process.env.REPOS_DIR;
    else process.env.REPOS_DIR = prevRepos;
    rmSync(root, { recursive: true, force: true });
  }
});

test("active env file falls back to .env when compose env_file is missing", () => {
  const root = mkdtempSync(join(tmpdir(), "vv-env-fallback-"));
  const prevRoot = process.env.VV_ROOT;
  const prevRepos = process.env.REPOS_DIR;
  process.env.VV_ROOT = root;
  delete process.env.REPOS_DIR;
  try {
    const repo = repoDir("shop");
    mkdirSync(repo, { recursive: true });
    writeFileSync(
      join(repo, "docker-compose.deploy.yml"),
      "services:\n  app:\n    image: shop:latest\n    env_file:\n      - .env.local\n    labels:\n      - traefik.enable=true\n",
    );
    writeFileSync(join(repo, ".env"), "FROM_DOTENV=1\n");
    expect(activeEnvPath("shop")).toBe(join(repo, ".env"));
    expect(loadProjectEnv("shop", "{}")).toEqual({ FROM_DOTENV: "1" });
    writeFileSync(join(repo, ".env.local"), "FROM_LOCAL=1\n");
    expect(activeEnvPath("shop")).toBe(join(repo, ".env.local"));
    expect(loadProjectEnv("shop", "{}")).toEqual({ FROM_LOCAL: "1" });
    writeProjectEnvFile("shop", { FROM_LOCAL: "2" });
    expect(readFileSync(join(repo, ".env.local"), "utf8")).toBe("FROM_LOCAL=2\n");
    expect(readFileSync(join(repo, ".env"), "utf8")).toBe("FROM_DOTENV=1\n");
  } finally {
    process.env.VV_ROOT = prevRoot;
    if (prevRepos === undefined) delete process.env.REPOS_DIR;
    else process.env.REPOS_DIR = prevRepos;
    rmSync(root, { recursive: true, force: true });
  }
});

test("writeProjectEnvFile writes to repo .env", () => {
  const root = mkdtempSync(join(tmpdir(), "vv-envf-"));
  const prevRoot = process.env.VV_ROOT;
  const prevRepos = process.env.REPOS_DIR;
  process.env.VV_ROOT = root;
  delete process.env.REPOS_DIR;
  try {
    mkdirSync(repoDir("shop"), { recursive: true });
    writeProjectEnvFile("shop", { FOO: "bar", NOTE: "a b" });
    expect(readFileSync(projectEnvPath("shop"), "utf8")).toBe('FOO=bar\nNOTE="a b"\n');
    expect(loadProjectEnv("shop", "{}")).toEqual({ FOO: "bar", NOTE: "a b" });
    writeProjectEnvFile("shop", {});
    expect(existsSync(projectEnvPath("shop"))).toBe(false);
  } finally {
    process.env.VV_ROOT = prevRoot;
    if (prevRepos === undefined) delete process.env.REPOS_DIR;
    else process.env.REPOS_DIR = prevRepos;
    rmSync(root, { recursive: true, force: true });
  }
});
