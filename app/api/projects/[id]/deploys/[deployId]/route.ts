import { getDeploy } from "@/lib/db/deploys";
import { getProject } from "@/lib/db/projects";
import { readDeployLog } from "@/lib/deploy-log";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; deployId: string }> },
) {
  const { id, deployId } = await params;
  if (!getProject(id)) return new Response("not found", { status: 404 });
  const deploy = getDeploy(id, deployId);
  if (!deploy) return new Response("not found", { status: 404 });
  let body: { text: string; truncated: boolean };
  try {
    body = readDeployLog(id, deployId);
  } catch {
    return Response.json(
      { text: "日志文件无法读取。", truncated: false },
      { headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { ...body, status: deploy.status },
    { headers: { "cache-control": "no-store" } },
  );
}
