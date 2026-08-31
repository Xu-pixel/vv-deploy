import { getProject } from "@/lib/db/projects";
import { startComposeLogStream } from "@/lib/log-stream";
import { sseResponse } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return new Response("not found", { status: 404 });

  const url = new URL(request.url);
  const service = url.searchParams.get("service") || undefined;
  const tailRaw = Number(url.searchParams.get("tail") ?? 100);
  const tail = Math.min(200, Math.max(20, Number.isFinite(tailRaw) ? tailRaw : 100));

  return sseResponse(request, (send) => {
    return startComposeLogStream(project.slug, { service, tail }, (line) => {
      send(line);
    });
  });
}
