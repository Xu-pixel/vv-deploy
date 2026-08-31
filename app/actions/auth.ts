"use server";

import { redirect } from "next/navigation";
import { loginWithKey, logout } from "@/lib/auth";

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const key = String(formData.get("key") ?? "");
  if (!key.trim()) return { error: "请输入 Admin 密钥" };
  const ok = await loginWithKey(key);
  if (!ok) return { error: "密钥不正确" };
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}
