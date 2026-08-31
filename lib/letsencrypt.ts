import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { AppConfig } from "./config";
import { ensureRuntimeDirs, letsEncryptDir, traefikDir } from "./paths";

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
  ensureRuntimeDirs();
  const acmeFile = join(letsEncryptDir(), "acme.json");
  if (!existsSync(acmeFile)) writeFileSync(acmeFile, "{}");
  chmodSync(acmeFile, 0o600);

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
