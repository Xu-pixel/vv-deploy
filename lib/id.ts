import { randomBytes } from "node:crypto";

/** 256-bit unguessable project id (64 hex chars). */
export function newProjectId(): string {
  return randomBytes(32).toString("hex");
}

export function newRowId(): string {
  return randomBytes(16).toString("hex");
}

export function newAdminKey(): string {
  return `vv_${randomBytes(24).toString("base64url")}`;
}
