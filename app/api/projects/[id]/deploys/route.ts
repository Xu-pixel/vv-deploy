import { listDeploys } from "@/lib/db/deploys";
import { getProject } from "@/lib/db/projects";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getProject(id)) return new Response("not found", { status: 404 });
  return Response.json(listDeploys(id), {
    headers: { "cache-control": "no-store" },
  });
}
