import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { bootstrapKeyPath, configPath, ensureRuntimeDirs, projectRoot } from "./paths";
import { newAdminKey } from "./id";
import { parseDomainSuffixes } from "./slug";

export type AppConfig = {
  adminKeyHash?: string;
  domainSuffixes: string[];
  traefikNetwork: string;
  letsEncryptEnabled: boolean;
  letsEncryptEmail: string;
};

type RawConfig = Omit<Partial<AppConfig>, "domainSuffixes"> & {
  domainSuffix?: string;
  domainSuffixes?: unknown;
};

const defaults: AppConfig = {
  domainSuffixes: [],
  traefikNetwork: "traefik",
  letsEncryptEnabled: false,
  letsEncryptEmail: "",
};

function migrateLegacyConfig(): void {
  const dest = configPath();
  const src = join(projectRoot(), "config.json");
  try {
    if (existsSync(dest) && statSync(dest).isDirectory()) {
      rmSync(dest, { recursive: true });
    }
    if (existsSync(dest) && statSync(dest).isFile()) return;
    if (existsSync(src) && statSync(src).isFile()) {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
  } catch {
    /* ignore */
  }
}

function readRaw(): RawConfig {
  migrateLegacyConfig();
  const path = configPath();
  if (!existsSync(path) || !statSync(path).isFile()) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as RawConfig;
  } catch {
    return {};
  }
}

export function readConfig(): AppConfig {
  const raw = readRaw();
  const suffixes = parseDomainSuffixes(
    Array.isArray(raw.domainSuffixes) && raw.domainSuffixes.length > 0
      ? raw.domainSuffixes
      : raw.domainSuffix,
  );
  return {
    ...defaults,
    adminKeyHash: raw.adminKeyHash,
    domainSuffixes: suffixes,
    traefikNetwork: raw.traefikNetwork?.trim() || defaults.traefikNetwork,
    letsEncryptEnabled: Boolean(raw.letsEncryptEnabled),
    letsEncryptEmail: String(raw.letsEncryptEmail ?? "").trim(),
  };
}

export function writeConfig(patch: Partial<AppConfig>): AppConfig {
  migrateLegacyConfig();
  const next = { ...readConfig(), ...patch };
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && statSync(path).isDirectory()) {
    rmSync(path, { recursive: true });
  }
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        ...next,
        domainSuffix: next.domainSuffixes[0] ?? "",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return next;
}

export function writeBootstrapKey(key: string): void {
  ensureRuntimeDirs();
  const path = bootstrapKeyPath();
  writeFileSync(path, `${key}\n`, "utf8");
  chmodSync(path, 0o600);
}

export function readBootstrapKey(): string | null {
  const path = bootstrapKeyPath();
  if (!existsSync(path)) return null;
  const key = readFileSync(path, "utf8").trim();
  return key || null;
}

export function clearBootstrapKey(): void {
  const path = bootstrapKeyPath();
  if (existsSync(path)) unlinkSync(path);
}

export async function hashAdminKey(key: string): Promise<string> {
  return Bun.password.hash(key, { algorithm: "argon2id" });
}

export async function verifyAdminKey(key: string, hash: string): Promise<boolean> {
  return Bun.password.verify(key, hash);
}

/** Create admin key on first boot. Returns plaintext only when newly generated. */
export async function ensureAdminKey(): Promise<{ created: boolean; key?: string }> {
  const current = readConfig();
  if (current.adminKeyHash) return { created: false };
  const key = newAdminKey();
  const adminKeyHash = await hashAdminKey(key);
  writeConfig({ adminKeyHash });
  writeBootstrapKey(key);
  console.log(`\n[vv-deploy] Admin key (save now):\n${key}\n`);
  return { created: true, key };
}

export async function resetAdminKey(): Promise<string> {
  const key = newAdminKey();
  const adminKeyHash = await hashAdminKey(key);
  writeConfig({ adminKeyHash });
  writeBootstrapKey(key);
  return key;
}
