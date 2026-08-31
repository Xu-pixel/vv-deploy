import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { applyMigrations } from "./migrate";
import { sqlitePath } from "../paths";

if (typeof Bun === "undefined") {
  throw new Error("vv-deploy 必须用 Bun 运行（bun run dev / bun run start）");
}

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    const file = sqlitePath();
    mkdirSync(dirname(file), { recursive: true });
    db = new Database(file, { create: true, strict: true });
    db.run("PRAGMA journal_mode = WAL;");
    db.run("PRAGMA foreign_keys = ON;");
  }
  applyMigrations(db);
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}
