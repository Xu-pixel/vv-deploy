import { AdminBar } from "@/components/admin-bar";
import { HomeProjects } from "@/components/home-projects";
import { requireAdmin } from "@/lib/auth";
import { readConfig } from "@/lib/config";
import { listProjects } from "@/lib/db/projects";
import { observedRuntime } from "@/lib/deploy";
import { readProjectFace } from "@/lib/project-face";
import { findProjectIcon, projectIconUrl } from "@/lib/project-icon";
import { projectHost, resolveDomainSuffix } from "@/lib/slug";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const projects = listProjects();
  const { domainSuffixes } = readConfig();
  const runtimeById = Object.fromEntries(
    await Promise.all(
      projects.map(async (project) => [project.id, (await observedRuntime(project)).status] as const),
    ),
  );
  const faces = Object.fromEntries(
    projects.map((project) => [
      project.id,
      readProjectFace(
        project,
        projectHost(project.slug, resolveDomainSuffix(project.domain_suffix, domainSuffixes)),
      ),
    ]),
  );
  const iconById = Object.fromEntries(
    projects.flatMap((project) =>
      findProjectIcon(project.slug)
        ? [[project.id, projectIconUrl(project.id, project.last_commit_sha)]]
        : [],
    ),
  );

  return (
    <div className="flex flex-1 flex-col">
      <AdminBar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-20 md:px-10">
        <HomeProjects
          projects={projects}
          faces={faces}
          runtimeById={runtimeById}
          iconById={iconById}
          initialQ={q ?? ""}
        />
      </main>
    </div>
  );
}
