import { expect, test } from "bun:test";
import { pickExposeService, parseCompose, rewriteCompose } from "./compose";
import { isGitRepo, parseBranch, parseLsRemote } from "./git";
import { isLetsEncryptSuffix, writeTraefikAcmeFiles } from "./letsencrypt";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("pick web service", () => {
  const compose = parseCompose(`
services:
  db:
    image: postgres
  web:
    image: nginx
    ports:
      - "8080:80"
`);
  expect(pickExposeService(compose)).toBe("web");
});

test("rewrite volumes, host, and strip ports", () => {
  process.env.HOST_ROOT = "/host/vv";
  const { compose, exposeService, exposePort, volumeNotes } = rewriteCompose({
    text: `
services:
  web:
    image: nginx
    ports:
      - "3000:3000"
    volumes:
      - dbdata:/var/lib/data
      - ./data:/app/data
    labels:
      - traefik.enable=true
      - traefik.http.routers.old.rule=Host(\`wrong.local\`)
volumes:
  dbdata:
`,
    slug: "shop",
    domainSuffix: "example.com",
    traefikNetwork: "traefik",
  });

  expect(exposeService).toBe("web");
  expect(exposePort).toBe(3000);
  const web = compose.services!.web;
  expect(web.ports).toBeUndefined();
  expect(web.labels).toContain("traefik.http.routers.shop.rule=Host(`shop.example.com`)");
  expect(web.volumes).toContain("/host/vv/volumes/shop/named/dbdata:/var/lib/data");
  expect(web.volumes).toContain("/host/vv/volumes/shop/bind/data:/app/data");
  expect(compose.networks).toMatchObject({
    traefik: { external: true, name: "traefik" },
  });
  expect(volumeNotes.length).toBeGreaterThan(0);
});

test("inject lets encrypt host labels", () => {
  const { compose } = rewriteCompose({
    text: `
services:
  web:
    image: nginx
    ports:
      - "3000:3000"
`,
    slug: "shop",
    domainSuffix: "example.com",
    traefikNetwork: "traefik",
    certResolver: "letsencrypt",
  });
  const labels = compose.services!.web.labels as string[];
  expect(labels).toContain("traefik.http.routers.shop.rule=Host(`shop.example.com`)");
  expect(labels).toContain("traefik.http.routers.shop.entrypoints=web,websecure");
  expect(labels).toContain("traefik.http.routers.shop.tls.certresolver=letsencrypt");
  expect(labels.some((l) => l.includes("tls.domains"))).toBe(false);
});

test("lets encrypt labels apply to sslip hosts too", () => {
  const { compose } = rewriteCompose({
    text: `
services:
  web:
    image: nginx
    ports:
      - "3000:3000"
`,
    slug: "shop",
    domainSuffix: "127-0-0-1.sslip.io",
    traefikNetwork: "traefik",
    certResolver: "letsencrypt",
  });
  const labels = compose.services!.web.labels as string[];
  expect(labels).toContain(
    "traefik.http.routers.shop.rule=Host(`shop.127-0-0-1.sslip.io`)",
  );
  expect(labels).toContain("traefik.http.routers.shop.entrypoints=web,websecure");
  expect(labels).toContain("traefik.http.routers.shop.tls.certresolver=letsencrypt");
});

test("reject volume env interpolation", () => {
  expect(() =>
    rewriteCompose({
      text: `
services:
  web:
    image: nginx
    volumes:
      - \${COURSE_ASSISTANT_DATA_ROOT:-/tank2/data}:/data/course-materials:ro
`,
      slug: "shop",
      domainSuffix: "example.com",
      traefikNetwork: "traefik",
    }),
  ).toThrow("${VAR}");
});
