export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { readConfig } = await import("./lib/config");
  const { writeTraefikAcmeFiles } = await import("./lib/letsencrypt");
  try {
    writeTraefikAcmeFiles(readConfig());
  } catch (err) {
    console.warn("[vv-deploy] traefik acme config:", err);
  }
}
