import { getCredential } from "./db/credentials";
import type { Project } from "./db/types";
import { listRemoteBranches } from "./git";

export async function projectRemoteBranches(
  project: Project,
): Promise<{ branches: string[]; error?: string }> {
  if (!project.credential_id) {
    return { branches: [project.branch], error: "项目没有绑定 Git 凭证" };
  }
  const cred = getCredential(project.credential_id);
  if (!cred) {
    return { branches: [project.branch], error: "Git 凭证不存在" };
  }
  try {
    const remote = await listRemoteBranches({
      url: project.git_url,
      privateKeyPath: cred.private_key_path,
    });
    const names = [project.branch, ...remote.branches];
    return { branches: [...new Set(names)] };
  } catch (err) {
    return {
      branches: [project.branch],
      error: err instanceof Error ? err.message : "检索远程分支失败",
    };
  }
}
