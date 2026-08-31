import { createHash } from "node:crypto";
import { parse, stringify } from "yaml";
import { applyServiceEnv, type EnvMap } from "./env";
import { hostVolumesDir } from "./paths";
import { projectHost } from "./slug";

export type ComposeFile = {
  services?: Record<string, Record<string, unknown>>;
  volumes?: Record<string, unknown>;
  networks?: Record<string, unknown>;
  [key: string]: unknown;
};

export type VolumeNote = { from: string; to: string; reason: string };

export type RewriteResult = {
  compose: ComposeFile;
  exposeService: string;
  exposePort: number;
  volumeNotes: VolumeNote[];
  services: string[];
};

const WEB_NAMES = /^(web|app|frontend|nginx|proxy|server)$/i;
const WEB_PORTS = new Set([80, 443, 3000, 8080, 8000]);

export function parseCompose(text: string): ComposeFile {
  const doc = parse(text);
  if (!doc || typeof doc !== "object") {
    throw new Error("compose 文件不是有效的 YAML 对象");
  }
  return doc as ComposeFile;
}

export function listServices(compose: ComposeFile): string[] {
  return Object.keys(compose.services ?? {});
}

function labelsOf(service: Record<string, unknown>): string[] {
  const raw = service.labels;
  if (Array.isArray(raw)) return raw.map(String);
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(
      ([k, v]) => `${k}=${v}`,
    );
  }
  return [];
}

function hasTraefik(service: Record<string, unknown>): boolean {
  return labelsOf(service).some((l) => l === "traefik.enable=true" || l.startsWith("traefik.enable=true"));
}

function portsOf(service: Record<string, unknown>): number[] {
  const raw = service.ports;
  if (!Array.isArray(raw)) return [];
  const ports: number[] = [];
  for (const item of raw) {
    const port = containerPort(item);
    if (port) ports.push(port);
  }
  return ports;
}

export function containerPort(item: unknown): number | null {
  if (typeof item === "number") return item;
  if (typeof item === "object" && item && "target" in item) {
    const t = Number((item as { target: unknown }).target);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof item !== "string") return null;
  const cleaned = item.replace(/\/\w+$/, "");
  const parts = cleaned.split(":");
  const last = Number(parts[parts.length - 1]);
  return Number.isFinite(last) ? last : null;
}

export function pickExposeService(
  compose: ComposeFile,
  preferred?: string | null,
): string | null {
  const services = compose.services ?? {};
  const names = Object.keys(services);
  if (preferred && services[preferred]) return preferred;
  for (const name of names) {
    if (hasTraefik(services[name])) return name;
  }
  for (const name of names) {
    if (WEB_NAMES.test(name)) return name;
  }
  for (const name of names) {
    if (portsOf(services[name]).some((p) => WEB_PORTS.has(p))) return name;
  }
  for (const name of names) {
    if (portsOf(services[name]).length > 0) return name;
  }
  return names[0] ?? null;
}

function inferPort(
  service: Record<string, unknown>,
  preferred?: number | null,
): number {
  if (preferred && preferred > 0) return preferred;
  for (const label of labelsOf(service)) {
    const m = label.match(/loadbalancer\.server\.port=(\d+)/);
    if (m) return Number(m[1]);
  }
  const ports = portsOf(service);
  const web = ports.find((p) => WEB_PORTS.has(p));
  return web ?? ports[0] ?? 80;
}

const COMPOSE_VAR = /\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*/;

export function volumeUsesVariable(spec: unknown): string | null {
  if (typeof spec === "string" && COMPOSE_VAR.test(spec)) return spec;
  if (spec && typeof spec === "object") {
    const source = (spec as { source?: unknown }).source;
    if (typeof source === "string" && COMPOSE_VAR.test(source)) return source;
  }
  return null;
}

function collectVariableVolumes(compose: ComposeFile): string[] {
  const found: string[] = [];
  for (const service of Object.values(compose.services ?? {})) {
    if (!Array.isArray(service.volumes)) continue;
    for (const spec of service.volumes) {
      const hit = volumeUsesVariable(spec);
      if (hit) found.push(hit);
    }
  }
  return found;
}

function isSpecialBind(source: string): boolean {
  return source === "/var/run/docker.sock" || source.endsWith("/docker.sock");
}

function isNamedVolume(source: string): boolean {
  return Boolean(source) && !source.startsWith(".") && !source.startsWith("/") && !source.includes("/");
}

function extHash(source: string): string {
  return createHash("sha1").update(source).digest("hex").slice(0, 8);
}

function rewriteVolumeSpec(
  spec: unknown,
  slug: string,
  notes: VolumeNote[],
): unknown {
  const hostBase = hostVolumesDir(slug);

  const remap = (source: string): string => {
    if (isSpecialBind(source)) return source;
    if (isNamedVolume(source)) {
      const to = `${hostBase}/named/${source}`;
      notes.push({ from: source, to, reason: "命名卷" });
      return to;
    }
    if (source.startsWith("./") || source === ".") {
      const rel = source.replace(/^\.\//, "");
      const to = `${hostBase}/bind/${rel}`;
      notes.push({ from: source, to, reason: "相对路径" });
      return to;
    }
    if (source.startsWith("../") || (source.startsWith("/") && !isSpecialBind(source))) {
      const to = `${hostBase}/ext/${extHash(source)}`;
      notes.push({ from: source, to, reason: "仓库外路径，已重定向" });
      return to;
    }
    const to = `${hostBase}/bind/${source.replace(/^\//, "")}`;
    notes.push({ from: source, to, reason: "绑定路径" });
    return to;
  };

  if (typeof spec === "string") {
    const parts = spec.split(":");
    if (parts.length === 1) return spec;
    const [source, ...rest] = parts;
    return [remap(source), ...rest].join(":");
  }

  if (spec && typeof spec === "object") {
    const obj = { ...(spec as Record<string, unknown>) };
    if (typeof obj.source === "string") {
      obj.source = remap(obj.source);
      obj.type = "bind";
    }
    return obj;
  }

  return spec;
}

function rewriteServiceVolumes(
  service: Record<string, unknown>,
  slug: string,
  notes: VolumeNote[],
): void {
  if (!Array.isArray(service.volumes)) return;
  service.volumes = service.volumes.map((v) => rewriteVolumeSpec(v, slug, notes));
}

function stripHostPorts(service: Record<string, unknown>): void {
  if (!Array.isArray(service.ports)) return;
  delete service.ports;
}

function stripManagedTraefik(labels: string[]): {
  kept: string[];
  certResolver?: string;
  middlewares?: string;
} {
  let certResolver: string | undefined;
  let middlewares: string | undefined;
  const kept: string[] = [];
  for (const label of labels) {
    const mCert = label.match(/\.tls\.certresolver=(.+)$/);
    if (mCert) {
      certResolver = mCert[1];
      continue;
    }
    const mMid = label.match(/\.middlewares=(.+)$/);
    if (mMid) {
      middlewares = mMid[1];
      continue;
    }
    if (label.startsWith("traefik.")) continue;
    kept.push(label);
  }
  return { kept, certResolver, middlewares };
}

function applyTraefikLabels(
  service: Record<string, unknown>,
  opts: {
    slug: string;
    host: string;
    port: number;
    network: string;
    enable: boolean;
    certResolver?: string;
  },
): void {
  const { kept, certResolver, middlewares } = stripManagedTraefik(labelsOf(service));
  if (!opts.enable) {
    service.labels = [...kept, "traefik.enable=false"];
    return;
  }
  const resolver = opts.certResolver ?? certResolver;
  const labels = [
    ...kept,
    "traefik.enable=true",
    `traefik.docker.network=${opts.network}`,
    `traefik.http.routers.${opts.slug}.rule=Host(\`${opts.host}\`)`,
    `traefik.http.routers.${opts.slug}.entrypoints=${resolver ? "web,websecure" : "web"}`,
    `traefik.http.services.${opts.slug}.loadbalancer.server.port=${opts.port}`,
  ];
  if (resolver) {
    labels.push(`traefik.http.routers.${opts.slug}.tls=true`);
    labels.push(`traefik.http.routers.${opts.slug}.tls.certresolver=${resolver}`);
  }
  if (middlewares) {
    labels.push(`traefik.http.routers.${opts.slug}.middlewares=${middlewares}`);
  }
  service.labels = labels;
}

function attachNetwork(service: Record<string, unknown>, network: string): void {
  const raw = service.networks;
  const names = new Set<string>(["default"]);
  if (Array.isArray(raw)) {
    for (const n of raw) names.add(String(n));
  } else if (raw && typeof raw === "object") {
    for (const n of Object.keys(raw)) names.add(n);
  }
  names.add(network);
  service.networks = [...names];
}

export function rewriteCompose(opts: {
  text: string;
  slug: string;
  domainSuffix: string;
  traefikNetwork: string;
  exposeService?: string | null;
  exposePort?: number | null;
  certResolver?: string;
  env?: EnvMap;
}): RewriteResult {
  const compose = parseCompose(opts.text);
  delete compose.version;
  const services = compose.services ?? {};
  const names = Object.keys(services);
  if (names.length === 0) {
    throw new Error("compose 里没有 services");
  }

  const variableVolumes = collectVariableVolumes(compose);
  if (variableVolumes.length > 0) {
    throw new Error(
      [
        "compose 卷路径不能使用 ${VAR} 变量，请改成仓库内相对路径（如 ./data）或命名卷（如 pgdata）。",
        ...variableVolumes.map((v) => `  - ${v}`),
      ].join("\n"),
    );
  }

  const exposeService = pickExposeService(compose, opts.exposeService);
  if (!exposeService) throw new Error("无法确定入口服务");

  const exposePort = inferPort(services[exposeService], opts.exposePort);
  const host = projectHost(opts.slug, opts.domainSuffix);
  const notes: VolumeNote[] = [];

  for (const [name, service] of Object.entries(services)) {
    rewriteServiceVolumes(service, opts.slug, notes);
    stripHostPorts(service);
    applyServiceEnv(service, opts.env ?? {});
    applyTraefikLabels(service, {
      slug: opts.slug,
      host,
      port: exposePort,
      network: opts.traefikNetwork,
      enable: name === exposeService,
      certResolver: opts.certResolver,
    });
    attachNetwork(service, opts.traefikNetwork);
  }

  compose.networks = {
    ...(typeof compose.networks === "object" ? compose.networks : {}),
    [opts.traefikNetwork]: {
      external: true,
      name: opts.traefikNetwork,
    },
  };

  delete compose.volumes;

  return {
    compose,
    exposeService,
    exposePort,
    volumeNotes: notes,
    services: names,
  };
}

export function dumpCompose(compose: ComposeFile): string {
  return stringify(compose, { indent: 2 });
}
