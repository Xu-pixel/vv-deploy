export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureRuntimeDirs } = await import("./lib/paths");
  const { syncReposFromDisk } = await import("./lib/db/projects");
  ensureRuntimeDirs();
  syncReposFromDisk();
}
