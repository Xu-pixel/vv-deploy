import { getProject } from "@/lib/db/projects";
import { projectRemoteBranches } from "@/lib/branches";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const project = getProject((await params).id);
  if (!project) return Response.json({ error: "项目不存在" }, { status: 404 });
  return Response.json(await projectRemoteBranches(project), { headers: { "Cache-Control": "no-store" } });
}
