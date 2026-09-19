// functions/api/bugs/[id]/restore.ts
// POST - admin 恢复被软删除的 bug
export const onRequestPost: PagesFunction<{ DB: D1Database }> = async ({ request, env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  if (u.role !== "admin") return new Response("forbidden", { status: 403 });
  const id = Number(params.id);
  const bug = await env.DB.prepare("SELECT * FROM bugs WHERE id = ?").bind(id).first();
  if (!bug) return new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404, headers: { "Content-Type": "application/json" } });
  await env.DB.prepare("UPDATE bugs SET deleted_at = NULL, updated_at = ? WHERE id = ?").bind(Date.now(), id).run();
  await env.DB.prepare(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, created_at) VALUES (?, 'bug.restored', 'bug', ?, NULL, ?)`,
  ).bind(u.id, id, Date.now()).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};
