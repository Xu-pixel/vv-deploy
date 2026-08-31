import { readConfig } from "../lib/config";
import { writeTraefikAcmeFiles } from "../lib/letsencrypt";

writeTraefikAcmeFiles(readConfig());
console.log("traefik acme config written");
