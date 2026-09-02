import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearBootstrapKey, readConfig, verifyAdminKey } from "./config";

export const SESSION_COOKIE = "vv_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function sessionSecret(): string | null {
  return readConfig().adminKeyHash ?? null;
}

export function createSessionValue(secret: string): string {
  const exp = String(Date.now() + MAX_AGE_MS);
  return `${exp}.${sign(exp, secret)}`;
}

export function readSessionValue(value: string, secret: string): boolean {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return false;
  const exp = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(exp, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const expMs = Number(exp);
  return Number.isFinite(expMs) && expMs > Date.now();
}

async function cookieSecure(): Promise<boolean> {
  const proto = (await headers()).get("x-forwarded-proto");
  if (!proto) return false;
  return proto.split(",")[0]?.trim() === "https";
}

export async function isAdmin(): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret) return false;
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  return Boolean(value && readSessionValue(value, secret));
}

export async function requireAdmin(): Promise<void> {
  if (await isAdmin()) return;
  if (!readConfig().adminKeyHash) redirect("/setup");
  redirect("/login");
}

export async function loginWithKey(key: string): Promise<boolean> {
  const config = readConfig();
  if (!config.adminKeyHash) return false;
  const ok = await verifyAdminKey(key.trim(), config.adminKeyHash);
  if (!ok) return false;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionValue(config.adminKeyHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: MAX_AGE_MS / 1000,
  });
  clearBootstrapKey();
  return true;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE, { path: "/", secure: await cookieSecure() });
}
