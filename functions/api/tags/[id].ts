// functions/api/tags/[id].ts
export const onRequestDelete: PagesFunction<{ DB: D1Database }> = async ({ env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  if (u.role !== "admin") return new Response("forbidden", { status: 403 });
  const id = Number(params.id);
  const tag = await env.DB.prepare("SELECT project_id FROM tags WHERE id = ?").bind(id).first<{ project_id: number }>();
  if (!tag) return new Response("not found", { status: 404 });
  await env.DB.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};
