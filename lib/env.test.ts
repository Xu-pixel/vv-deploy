import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dumpCompose, rewriteCompose } from "./compose";
import { composeArgs } from "./docker";
import {
  applyServiceEnv,
  dumpDotenv,
  escapeComposeEnvValue,
  parseDotenv,
  parseEnvForm,
  parseEnvJson,
  readServiceEnv,
  syncProjectEnvFile,
} from "./env";
import { generatedEnvPath, overridesDir } from "./paths";

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

test("escape dollar for compose interpolation", () => {
  expect(escapeComposeEnvValue("a$b${C}")).toBe("a$$b$${C}");
});

test("merge list-form environment then override", () => {
  const service: Record<string, unknown> = {
    environment: ["EXISTING=1", "FLAG", "EQ=a=b"],
  };
  applyServiceEnv(service, { FLAG: "on", NEW: "x$y" });
  expect(service.environment).toEqual({
    EXISTING: "1",
    FLAG: "on",
    EQ: "a=b",
    NEW: "x$$y",
  });
});

test("read map-form environment", () => {
  expect(readServiceEnv({ environment: { FOO: "1", BAR: null } })).toEqual({
    FOO: "1",
    BAR: "",
  });
});

test("rewrite injects env into every service", () => {
  const { compose } = rewriteCompose({
    text: `
services:
  web:
    image: nginx
    environment:
      - KEEP=1
    ports:
      - "3000:3000"
  db:
    image: postgres
`,
    slug: "shop",
    domainSuffix: "example.com",
    traefikNetwork: "traefik",
    env: { DATABASE_URL: "postgres://x", TOKEN: "a$b" },
  });
  expect(compose.services!.web.environment).toEqual({
    KEEP: "1",
    DATABASE_URL: "postgres://x",
    TOKEN: "a$$b",
  });
  expect(compose.services!.db.environment).toEqual({
    DATABASE_URL: "postgres://x",
    TOKEN: "a$$b",
  });
  const dumped = dumpCompose(compose);
  expect(dumped).toContain("a$$b");
});

test("composeArgs includes env file when present", () => {
  const root = mkdtempSync(join(tmpdir(), "vv-env-"));
  const prev = process.env.VV_ROOT;
  process.env.VV_ROOT = root;
  try {
    mkdirSync(overridesDir("shop"), { recursive: true });
    expect(composeArgs("shop", ["up"])).not.toContain("--env-file");
    writeFileSync(generatedEnvPath("shop"), "FOO=bar\n");
    chmodSync(generatedEnvPath("shop"), 0o600);
    const args = composeArgs("shop", ["up"]);
    expect(args[2]).toBe("--env-file");
    expect(args[3]).toBe(generatedEnvPath("shop"));
    expect(readFileSync(generatedEnvPath("shop"), "utf8")).toBe("FOO=bar\n");
  } finally {
    process.env.VV_ROOT = prev;
    rmSync(root, { recursive: true, force: true });
  }
});

test("syncProjectEnvFile writes and removes", () => {
  const root = mkdtempSync(join(tmpdir(), "vv-envf-"));
  const prev = process.env.VV_ROOT;
  process.env.VV_ROOT = root;
  try {
    syncProjectEnvFile("shop", { FOO: "bar", NOTE: "a b" });
    expect(readFileSync(generatedEnvPath("shop"), "utf8")).toBe('FOO=bar\nNOTE="a b"\n');
    syncProjectEnvFile("shop", {});
    expect(existsSync(generatedEnvPath("shop"))).toBe(false);
  } finally {
    process.env.VV_ROOT = prev;
    rmSync(root, { recursive: true, force: true });
  }
});
