import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { repoDir } from "./paths";

const DIRS = ["", "public", "app", "src/app", "src", "assets", "static"];
const NAMES = [
  "icon.svg",
  "icon.png",
  "icon.webp",
  "icon.jpg",
  "icon.jpeg",
  "icon.ico",
  "logo.svg",
  "logo.png",
  "favicon.svg",
  "favicon.png",
  "favicon.ico",
  "apple-touch-icon.png",
];

const MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

export type ProjectIcon = {
  path: string;
  mime: string;
};

function listing(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return map;
  for (const name of readdirSync(dir)) {
    map.set(name.toLowerCase(), name);
  }
  return map;
}

export function findProjectIcon(slug: string): ProjectIcon | null {
  const root = repoDir(slug);
  if (!existsSync(root)) return null;
  const base = realpathSync(root);
  const listings = new Map<string, Map<string, string>>();
  for (const rel of DIRS) {
    listings.set(rel, listing(rel ? join(/* turbopackIgnore: true */ root, rel) : root));
  }
  for (const name of NAMES) {
    for (const rel of DIRS) {
      const realName = listings.get(rel)?.get(name);
      if (!realName) continue;
      const full = join(rel ? join(/* turbopackIgnore: true */ root, rel) : root, realName);
      if (!statSync(full).isFile()) continue;
      const resolved = realpathSync(full);
      if (!resolved.startsWith(base + "/") && resolved !== base) continue;
      const mime = MIME[extname(resolved).toLowerCase()];
      if (!mime) continue;
      return { path: resolved, mime };
    }
  }
  return null;
}

export function readProjectIcon(slug: string): { body: Buffer; mime: string } | null {
  const icon = findProjectIcon(slug);
  if (!icon) return null;
  return { body: readFileSync(icon.path), mime: icon.mime };
}

export function projectIconUrl(id: string, commitSha: string | null): string {
  return `/api/projects/${id}/icon?v=${commitSha ?? "0"}`;
}
