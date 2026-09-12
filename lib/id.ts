import { randomBytes } from "node:crypto";

/** 256-bit unguessable project id (32 bytes, base64url for `/app/[id]`). */
export function newProjectId(): string {
  return randomBytes(32).toString("base64url");
}

export function newRowId(): string {
  return randomBytes(16).toString("hex");
}

export function newAdminKey(): string {
  return `vv_${randomBytes(24).toString("base64url")}`;
}
