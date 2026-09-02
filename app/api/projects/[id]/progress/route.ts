import { jobAlive } from "@/lib/deploy";
import { getProject } from "@/lib/db/projects";
import { listComposeContainers } from "@/lib/docker";
import { getProgressLine, progressEvent, subscribeProgress } from "@/lib/progress";
import { sseResponse } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getProject(id)) return new Response("not found", { status: 404 });

  return sseResponse(request, (send) => {
    let pushing = false;
    let queued = false;
    let lastJson = "";
    let containers: string[] = [];
    let listedFor = "";

    const push = async () => {
      if (pushing) {
        queued = true;
        return;
      }
      pushing = true;
      try {
        do {
          queued = false;
          const project = getProject(id);
          if (!project) return;
          const { line, percent } = getProgressLine(id);
          const alive = jobAlive(id);
          if (project.status === "running" && !alive) {
            if (listedFor !== "running") {
              containers = await listComposeContainers(project.slug);
              listedFor = "running";
            }
          } else {
            containers = [];
            listedFor = "";
          }
          const payload = progressEvent({
            status: project.status,
            line,
            percent,
            error: project.last_error,
            containers,
          });
          const json = JSON.stringify(payload);
          if (json === lastJson) continue;
          lastJson = json;
          send(payload);
        } while (queued);
      } finally {
        pushing = false;
      }
    };

    void push();
    return subscribeProgress(id, () => {
      void push();
    });
  });
}
