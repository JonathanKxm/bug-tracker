// functions/api/projects/[id]/sankey.ts - 项目维度的状态流转图
import { ALL_STATUSES } from "../../../lib/states";

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const projectId = Number(params.id);
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(projectId, u.id).first();
    if (!m) return new Response("forbidden", { status: 403 });
  }

  const rows = await env.DB.prepare(`
    SELECT h.from_status, h.to_status, COUNT(*) AS n
    FROM bug_history h JOIN bugs b ON b.id = h.bug_id
    WHERE b.project_id = ?
    GROUP BY h.from_status, h.to_status
  `).bind(projectId).all<{ from_status: string | null; to_status: string; n: number }>();

  const nodes = ALL_STATUSES.map((s) => ({ name: s }));
  const links: { source: string; target: string; value: number }[] = [];
  for (const r of rows.results ?? []) {
    if (!r.from_status) continue;
    if (ALL_STATUSES.includes(r.from_status as any) && ALL_STATUSES.includes(r.to_status as any)) {
      links.push({ source: r.from_status as any, target: r.to_status as any, value: r.n });
    }
  }
  return new Response(JSON.stringify({ nodes, links }), { headers: { "Content-Type": "application/json" } });
};
