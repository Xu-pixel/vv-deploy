const NAME_RE = /[/:]([^/:]+?)(?:\.git)?$/;

export function parseGitUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim();
  const scp = trimmed.match(/^git@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (scp) return { owner: scp[1], repo: scp[2] };
  try {
    const u = new URL(trimmed.replace(/^git\+/, ""));
    const parts = u.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (parts.length >= 2) {
      return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
    }
  } catch {
    const m = trimmed.match(NAME_RE);
    if (m) return { owner: "unknown", repo: m[1] };
  }
  return null;
}

export function slugifyRepo(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\.git$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "app";
}

export function normalizeDomainSuffix(value: string): string {
  return value.trim().replace(/^\./, "");
}

export function parseDomainSuffixes(raw: unknown): string[] {
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\n,]+/)
      : [];
  const seen = new Set<string>();
  const suffixes: string[] = [];
  for (const item of items) {
    const suffix = normalizeDomainSuffix(String(item));
    if (!suffix || seen.has(suffix)) continue;
    seen.add(suffix);
    suffixes.push(suffix);
  }
  return suffixes;
}

export function resolveDomainSuffix(
  chosen: string | null | undefined,
  suffixes: string[],
): string {
  const suffix = normalizeDomainSuffix(chosen ?? "");
  if (suffix && suffixes.includes(suffix)) return suffix;
  return suffixes[0] ?? "";
}

export function projectHost(slug: string, domainSuffix: string): string {
  const suffix = normalizeDomainSuffix(domainSuffix);
  return suffix ? `${slug}.${suffix}` : slug;
}

const HOST_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Hostname only: strips scheme/path. Empty string means “use default”. */
export function parseHostname(raw: string): string | null {
  let host = raw.trim().toLowerCase();
  if (!host) return "";
  host = host.replace(/^https?:\/\//, "");
  host = host.replace(/[/:].*$/, "");
  host = host.replace(/\.$/, "");
  if (!host) return "";
  if (host.length > 253) return null;
  const labels = host.split(".");
  if (labels.some((label) => !HOST_LABEL.test(label))) return null;
  return host;
}

export function inferDomainSuffix(host: string, suffixes: string[]): string | null {
  const value = parseHostname(host);
  if (!value) return null;
  for (const suffix of suffixes) {
    const normalized = normalizeDomainSuffix(suffix);
    if (!normalized) continue;
    if (value === normalized || value.endsWith(`.${normalized}`)) return normalized;
  }
  return null;
}

export function resolveProjectHost(
  project: {
    slug: string;
    domain_suffix?: string | null;
    custom_domain?: string | null;
  },
  suffixes: string[],
): string {
  const custom = parseHostname(project.custom_domain ?? "");
  if (custom) return custom;
  return projectHost(project.slug, resolveDomainSuffix(project.domain_suffix, suffixes));
}
