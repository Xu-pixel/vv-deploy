import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { AppConfig } from "./config";
import { letsEncryptDir, projectRoot, traefikDir } from "./paths";

export function isLetsEncryptSuffix(suffix: string): boolean {
  const value = suffix.trim().replace(/^\./, "");
  return value.includes(".");
}

export function usesLetsEncrypt(config: AppConfig): boolean {
  return config.letsEncryptEnabled && Boolean(config.letsEncryptEmail);
}

export function projectUsesHttps(config: AppConfig, _suffix?: string): boolean {
  return usesLetsEncrypt(config);
}

export function projectOrigin(_config: AppConfig, host: string, _suffix: string): string {
  return `https://${host}`;
}

export function writeTraefikAcmeFiles(config: AppConfig): void {
  // Only dirs under data/ — migrate mounts data alone, not repos/volumes/…
  mkdirSync(join(projectRoot(), "data"), { recursive: true });
  mkdirSync(traefikDir(), { recursive: true });
  mkdirSync(letsEncryptDir(), { recursive: true });
  const acmeFile = join(letsEncryptDir(), "acme.json");
  if (!existsSync(acmeFile)) writeFileSync(acmeFile, "{}");
  try {
    chmodSync(acmeFile, 0o600);
  } catch {
    /* 文件可能由 Traefik 用 root 创建，容器外改不了权限 */
  }

  const enabled = usesLetsEncrypt(config);
  const staticConfig: Record<string, unknown> = {
    entryPoints: {
      web: { address: "0.0.0.0:80" },
      websecure: { address: "0.0.0.0:443" },
    },
    providers: {
      docker: {
        exposedByDefault: false,
        network: config.traefikNetwork || "traefik",
      },
    },
    ping: {},
  };

  if (enabled) {
    staticConfig.certificatesResolvers = {
      letsencrypt: {
        acme: {
          email: config.letsEncryptEmail,
          storage: "/letsencrypt/acme.json",
          httpChallenge: { entryPoint: "web" },
        },
      },
    };
  }

  writeFileSync(join(traefikDir(), "traefik.yml"), stringify(staticConfig));
  writeFileSync(join(traefikDir(), "dynamic.yml"), "{}\n");
  writeFileSync(join(traefikDir(), "acme.env"), "\n");
}
