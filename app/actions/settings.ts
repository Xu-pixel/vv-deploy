"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { writeConfig } from "@/lib/config";
import { writeTraefikAcmeFiles } from "@/lib/letsencrypt";
import { parseDomainSuffixes } from "@/lib/slug";
import { unlinkSync } from "node:fs";
import {
  countProjectsUsingCredential,
  deleteCredential,
  getCredential,
  insertCredential,
  isProvider,
} from "@/lib/db/credentials";
import { generateSshKey } from "@/lib/git";

export async function saveDomainAction(
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const domainSuffixes = parseDomainSuffixes(String(formData.get("domainSuffixes") ?? ""));
  const traefikNetwork =
    String(formData.get("traefikNetwork") ?? "").trim() || "traefik";
  const letsEncryptEnabled = formData.get("letsEncryptEnabled") === "1";
  const letsEncryptEmail = String(formData.get("letsEncryptEmail") ?? "").trim();
  if (letsEncryptEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(letsEncryptEmail)) {
    return { error: "开启 Let's Encrypt 需要填写有效邮箱" };
  }
  const next = writeConfig({
    domainSuffixes,
    traefikNetwork,
    letsEncryptEnabled,
    letsEncryptEmail,
  });
  writeTraefikAcmeFiles(next);
  revalidatePath("/settings");
  revalidatePath("/");
  return {};
}

export async function createCredentialAction(
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const provider = String(formData.get("provider") ?? "");
  if (!name) return { error: "请填写凭证名称" };
  if (!isProvider(provider)) return { error: "不支持的 Git 平台" };
  const key = await generateSshKey(name, provider);
  insertCredential({
    id: key.id,
    name,
    provider,
    public_key: key.publicKey,
    private_key_path: key.privateKeyPath,
  });
  revalidatePath("/settings");
  return {};
}

export async function deleteCredentialAction(
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (countProjectsUsingCredential(id) > 0) {
    return { error: "仍有项目在使用这把密钥" };
  }
  const cred = getCredential(id);
  deleteCredential(id);
  if (cred) {
    try {
      unlinkSync(cred.private_key_path);
      unlinkSync(`${cred.private_key_path}.pub`);
    } catch {
      /* already gone */
    }
  }
  revalidatePath("/settings");
  return {};
}
