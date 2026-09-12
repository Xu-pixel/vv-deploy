import { expect, test } from "bun:test";
import { listServices, parseCompose } from "./compose";
import { findDeployComposeFile, isGitRepo, parseBranch, parseLsRemote } from "./git";
import { newProjectId } from "./id";
import { isLetsEncryptSuffix, writeTraefikAcmeFiles } from "./letsencrypt";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reposDir, listRepoSlugs } from "./paths";
import {
  parseDomainSuffixes,
  parseGitUrl,
  projectHost,
  resolveDomainSuffix,
  slugifyRepo,
} from "./slug";

test("parse ls-remote heads", () => {
  const parsed = parseLsRemote(`
ref: refs/heads/main	HEAD
abc	HEAD
abc	refs/heads/main
def	refs/heads/feat/login
`);
  expect(parsed.defaultBranch).toBe("main");
  expect(parsed.branches).toEqual(["main", "feat/login"]);
});

test("detect existing git repo for pull", () => {
  const root = mkdtempSync(join(tmpdir(), "vv-git-"));
  try {
    expect(isGitRepo(root)).toBe(false);
    mkdirSync(join(root, ".git"));
    expect(isGitRepo(root)).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("parse branch names", () => {
  expect(parseBranch("main")).toBe("main");
  expect(parseBranch("feat/login")).toBe("feat/login");
  expect(parseBranch("feat login")).toBe(null);
  expect(parseBranch("HEAD")).toBe(null);
  expect(parseBranch("../etc")).toBe(null);
});

test("slug from repo name", () => {
  expect(slugifyRepo("My App.git")).toBe("my-app");
  expect(parseGitUrl("git@gitee.com:acme/shop.git")).toEqual({
    owner: "acme",
    repo: "shop",
  });
  expect(projectHost("shop", "example.com")).toBe("shop.example.com");
  expect(parseDomainSuffixes("example.com\n.sslip.io\nexample.com")).toEqual([
    "example.com",
    "sslip.io",
  ]);
  expect(resolveDomainSuffix("sslip.io", ["example.com", "sslip.io"])).toBe("sslip.io");
  expect(resolveDomainSuffix("gone.com", ["example.com", "sslip.io"])).toBe("example.com");
  expect(isLetsEncryptSuffix("example.com")).toBe(true);
  expect(isLetsEncryptSuffix("127-0-0-1.sslip.io")).toBe(true);
  expect(isLetsEncryptSuffix("10-0-0-1.nip.io")).toBe(true);
  expect(isLetsEncryptSuffix("localhost")).toBe(false);
});

test("write http-01 traefik acme files", () => {
  const root = mkdtempSync(join(tmpdir(), "vv-le-"));
  const prev = process.env.VV_ROOT;
  process.env.VV_ROOT = root;
  try {
    writeTraefikAcmeFiles({
      domainSuffixes: ["example.com", "127.0.0.1.sslip.io"],
      traefikNetwork: "traefik",
      letsEncryptEnabled: true,
      letsEncryptEmail: "ops@example.com",
    });
    const staticYml = readFileSync(join(root, "data/traefik/traefik.yml"), "utf8");
    expect(staticYml).toContain("httpChallenge");
    expect(staticYml).toContain("ops@example.com");
    expect(staticYml).not.toContain("dnsChallenge");
  } finally {
    process.env.VV_ROOT = prev;
    rmSync(root, { recursive: true, force: true });
  }
});

test("list compose services without rewriting", () => {
  const compose = parseCompose(`
services:
  db:
    image: postgres
  web:
    image: nginx
    ports:
      - "8080:80"
`);
  expect(listServices(compose)).toEqual(["db", "web"]);
});

test("find docker-compose.deploy.yaml", () => {
  const root = mkdtempSync(join(tmpdir(), "vv-prod-"));
  try {
    expect(findDeployComposeFile(root)).toBe(null);
    writeFileSync(join(root, "docker-compose.yml"), "services: {}\n");
    expect(findDeployComposeFile(root)).toBe(null);
    writeFileSync(join(root, "docker-compose.deploy.yaml"), "services: {}\n");
    expect(findDeployComposeFile(root)).toBe(join(root, "docker-compose.deploy.yaml"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("project id is 32 bytes base64url", () => {
  const id = newProjectId();
  expect(Buffer.from(id, "base64url").length).toBe(32);
  expect(id).not.toMatch(/[+/=]/);
});

test("listRepoSlugs reads REPOS_DIR", () => {
  const root = mkdtempSync(join(tmpdir(), "vv-scan-"));
  const prev = process.env.REPOS_DIR;
  process.env.REPOS_DIR = root;
  try {
    mkdirSync(join(root, "shop"));
    mkdirSync(join(root, ".hidden"));
    writeFileSync(join(root, "file.txt"), "x");
    expect(listRepoSlugs()).toEqual(["shop"]);
  } finally {
    if (prev === undefined) delete process.env.REPOS_DIR;
    else process.env.REPOS_DIR = prev;
    rmSync(root, { recursive: true, force: true });
  }
});

test("reposDir uses REPOS_DIR", () => {
  const prev = process.env.REPOS_DIR;
  process.env.REPOS_DIR = "/mnt/repos";
  try {
    expect(reposDir()).toBe("/mnt/repos");
  } finally {
    if (prev === undefined) delete process.env.REPOS_DIR;
    else process.env.REPOS_DIR = prev;
  }
});
