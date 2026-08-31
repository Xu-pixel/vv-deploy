import { jobAlive } from "@/lib/deploy";
import { getProject } from "@/lib/db/projects";
import { listComposeContainers } from "@/lib/docker";
import { getProgressLine, subscribeProgress } from "@/lib/progress";
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
          const { line, seq, percent } = getProgressLine(id);
          const alive = jobAlive(id);
          const containers =
            !alive && project.status === "running"
              ? await listComposeContainers(project.slug)
              : [];
          send({
            status: project.status,
            alive,
            error: project.last_error,
            line,
            seq,
            percent,
            containers,
          });
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
