import { isAdmin } from "@/lib/auth";
import { listProjects } from "@/lib/db/projects";
import { observedRuntime } from "@/lib/deploy";
export async function GET() {
 if (!await isAdmin()) return Response.json({}, { status: 401 });
 const statuses = await Promise.all(listProjects().map(async p => [p.id, (await observedRuntime(p)).status]));
 return Response.json(Object.fromEntries(statuses), { headers: { "Cache-Control": "no-store" } });
}
