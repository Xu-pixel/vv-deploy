import { readFileSync } from "node:fs";
import { readDeploySurface } from "./deploy-surface";
import type { Project } from "./db/types";
import { findDeployComposeFile, readRepoSnapshot } from "./git";
import { repoDir } from "./paths";

export type ProjectFace = {
  title: string;
  host: string;
  origin: string | null;
  gitUrl: string;
  branch: string;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthor: string | null;
  commitAt: string | null;
};

export function readProjectFace(project: Project, fallbackHost: string): ProjectFace {
  const repo = repoDir(project.slug);
  const snap = readRepoSnapshot(repo);
  let title = project.name;
  let host = fallbackHost;
  let origin: string | null = null;
  const composeFile = findDeployComposeFile(repo);
  if (composeFile) {
    try {
      const surface = readDeploySurface(readFileSync(composeFile, "utf8"));
      if (surface.name) title = surface.name;
      if (surface.host) {
        host = surface.host;
        origin = `${surface.https ? "https" : "http"}://${surface.host}`;
      }
    } catch {
      /* 坏掉的 compose 仍显示仓库信息 */
    }
  }
  return {
    title,
    host,
    origin,
    gitUrl: snap.url || project.git_url,
    branch: snap.branch || project.branch,
    commitSha: snap.sha,
    commitMessage: snap.message,
    commitAuthor: snap.author,
    commitAt: snap.committedAt,
  };
}
