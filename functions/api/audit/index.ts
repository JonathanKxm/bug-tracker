// functions/api/audit/index.ts
export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  if (u.role !== "admin") return new Response("forbidden", { status: 403 });
  const url = new URL(request.url);
  const targetType = url.searchParams.get("target_type");
  const targetId = url.searchParams.get("target_id");

  const where: string[] = [];
  const params: unknown[] = [];
  if (targetType) { where.push("target_type = ?"); params.push(targetType); }
  if (targetId) { where.push("target_id = ?"); params.push(Number(targetId)); }

  const rows = await env.DB.prepare(
    `SELECT a.*, u.name AS actor_name, u.email AS actor_email
     FROM audit_log a JOIN users u ON u.id = a.actor_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY a.created_at DESC LIMIT 200`,
  ).bind(...params).all();

  return new Response(JSON.stringify({ items: rows.results ?? [] }), { headers: { "Content-Type": "application/json" } });
};
