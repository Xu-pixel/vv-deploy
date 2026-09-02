import { applyMigrations } from "../lib/db/migrate";
import { getDb } from "../lib/db";
import { readConfig } from "../lib/config";
import { writeTraefikAcmeFiles } from "../lib/letsencrypt";

getDb();
applyMigrations(getDb());
writeTraefikAcmeFiles(readConfig());
console.log("migrations ok");
