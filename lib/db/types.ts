export type GitProvider = "gitee" | "github" | "other";

export type GitCredential = {
  id: string;
  name: string;
  provider: GitProvider;
  public_key: string;
  private_key_path: string;
  created_at: string;
};

export type ProjectStatus =
  | "idle"
  | "cloning"
  | "building"
  | "running"
  | "stopped"
  | "error";

export type Project = {
  id: string;
  name: string;
  slug: string;
  git_url: string;
  branch: string;
  credential_id: string | null;
  status: ProjectStatus;
  last_commit_sha: string | null;
  last_commit_message: string | null;
  last_commit_author: string | null;
  last_commit_at: string | null;
  expose_service: string | null;
  expose_port: number | null;
  domain_suffix: string | null;
  custom_domain: string | null;
  https: number;
  env_vars: string;
  last_deployed_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

