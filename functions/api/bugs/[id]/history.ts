// functions/api/bugs/[id]/history.ts - 状态流转图 (Sankey 数据)
import { ALL_STATUSES } from "../../../lib/states";

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);
  const bug = await env.DB.prepare("SELECT project_id FROM bugs WHERE id = ?").bind(id).first<{ project_id: number }>();
  if (!bug) return new Response("not found", { status: 404 });
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(bug.project_id, u.id).first();
    if (!m) return new Response("forbidden", { status: 403 });
  }
  const rows = await env.DB.prepare(
    "SELECT from_status, to_status, COUNT(*) AS n FROM bug_history WHERE bug_id = ? GROUP BY from_status, to_status",
  ).bind(id).all();

  // 构建 Sankey 数据
  const nodes: { name: string }[] = ALL_STATUSES.map((s) => ({ name: s }));
  const links: { source: string; target: string; value: number }[] = [];
  const seen = new Map<string, number>();
  for (const r of rows.results ?? []) {
    if (!r.from_status) continue; // 创建的不算
    const k = `${r.from_status}->${r.to_status}`;
    seen.set(k, (seen.get(k) ?? 0) + (r.n as number));
  }
  for (const [k, v] of seen) {
    const [s, t] = k.split("->");
    if (ALL_STATUSES.includes(s as any) && ALL_STATUSES.includes(t as any)) {
      links.push({ source: s as any, target: t as any, value: v });
    }
  }
  return new Response(JSON.stringify({ nodes, links }), { headers: { "Content-Type": "application/json" } });
};
