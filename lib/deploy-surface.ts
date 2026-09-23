import { parseCompose } from "./compose";

export type DeploySurface = {
  name: string | null;
  host: string | null;
  https: boolean;
  envFiles: string[];
};

const HOST_IN_RULE = /Host\(\s*[`'"]([^`'"]+)[`'"]\s*\)/;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function serviceLabels(service: Record<string, unknown>): string[] {
  const labels = service.labels;
  if (typeof labels === "string") return [labels];
  if (Array.isArray(labels)) return labels.filter((item): item is string => typeof item === "string");
  const record = asRecord(labels);
  if (!record) return [];
  return Object.entries(record).map(([key, value]) =>
    value == null || value === true ? key : `${key}=${String(value)}`,
  );
}

function traefikEnabled(labels: string[]): boolean {
  for (const label of labels) {
    if (label === "traefik.enable") return true;
    if (label.startsWith("traefik.enable=")) {
      return label.slice("traefik.enable=".length).trim() === "true";
    }
  }
  return false;
}

function imageRepoName(image: unknown): string | null {
  if (typeof image !== "string") return null;
  const ref = image.trim().split("@")[0] ?? "";
  const last = ref.split("/").pop() ?? "";
  const colon = last.lastIndexOf(":");
  const name = (colon > 0 ? last.slice(0, colon) : last).trim();
  return name || null;
}

function safeRel(value: string): string | null {
  const rel = value.trim();
  if (!rel || rel.startsWith("/") || rel.includes("\\")) return null;
  if (rel.split("/").some((part) => part === "..")) return null;
  return rel;
}

function envFilesOf(service: Record<string, unknown>): string[] {
  const raw = service.env_file;
  const items = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const item of items) {
    const text =
      typeof item === "string"
        ? item
        : asRecord(item) && typeof asRecord(item)?.path === "string"
          ? String(asRecord(item)?.path)
          : "";
    const rel = safeRel(text);
    if (rel && !out.includes(rel)) out.push(rel);
  }
  return out;
}

type RouterBits = { host?: string; https: boolean };

function routersOf(labels: string[]): RouterBits[] {
  const byName = new Map<string, RouterBits>();
  const bits = (name: string) => {
    const found = byName.get(name) ?? { https: false };
    byName.set(name, found);
    return found;
  };
  for (const label of labels) {
    const rule = label.match(/^traefik\.http\.routers\.([^.]+)\.rule=(.+)$/);
    if (rule) {
      const host = rule[2]?.match(HOST_IN_RULE)?.[1]?.trim();
      if (host) bits(rule[1] ?? "").host = host;
      continue;
    }
    const resolver = label.match(/^traefik\.http\.routers\.([^.]+)\.tls\.certresolver=/);
    if (resolver) {
      bits(resolver[1] ?? "").https = true;
      continue;
    }
    const tls = label.match(/^traefik\.http\.routers\.([^.]+)\.tls(?:=(.*))?$/);
    if (tls && (tls[2] == null || tls[2] === "" || tls[2] === "true")) {
      bits(tls[1] ?? "").https = true;
    }
  }
  return [...byName.values()];
}

function pickRouter(routers: RouterBits[]): RouterBits | null {
  return routers.find((router) => router.host && router.https) ?? routers.find((router) => router.host) ?? null;
}

export function readDeploySurface(text: string): DeploySurface {
  const compose = parseCompose(text);
  const services = compose.services ?? {};
  let chosen: DeploySurface | null = null;
  let fallbackEnv: string[] = [];
  for (const [serviceName, raw] of Object.entries(services)) {
    const service = asRecord(raw);
    if (!service) continue;
    const envFiles = envFilesOf(service);
    if (fallbackEnv.length === 0 && envFiles.length > 0) fallbackEnv = envFiles;
    const labels = serviceLabels(service);
    if (!traefikEnabled(labels)) continue;
    const router = pickRouter(routersOf(labels));
    const surface: DeploySurface = {
      name: imageRepoName(service.image) ?? serviceName,
      host: router?.host ?? null,
      https: router?.https ?? false,
      envFiles,
    };
    if (!chosen || (!chosen.host && surface.host)) chosen = surface;
  }
  if (chosen) {
    if (chosen.envFiles.length === 0) chosen.envFiles = fallbackEnv;
    return chosen;
  }
  return { name: null, host: null, https: false, envFiles: fallbackEnv };
}
