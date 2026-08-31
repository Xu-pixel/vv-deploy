import { applyMigrations } from "../lib/db/migrate";
import { getDb } from "../lib/db";

getDb();
applyMigrations(getDb());
console.log("migrations ok");
