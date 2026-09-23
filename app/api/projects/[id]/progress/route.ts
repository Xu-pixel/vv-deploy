import { observedRuntime } from "@/lib/deploy";
import { getProject } from "@/lib/db/projects";
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
          const live = await observedRuntime(project);
          const payload = progressEvent({
            status: live.status,
            line,
            percent,
            error: project.last_error,
            containers: live.containers,
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
    const timer = setInterval(() => {
      void push();
    }, 5000);
    const unsubscribe = subscribeProgress(id, () => {
      void push();
    });
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  });
}
