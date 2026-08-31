import { getProject } from "@/lib/db/projects";
import { readProjectIcon } from "@/lib/project-icon";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return new Response("not found", { status: 404 });
  const icon = readProjectIcon(project.slug);
  if (!icon) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(icon.body), {
    headers: {
      "Content-Type": icon.mime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
