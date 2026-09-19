// functions/api/tags/index.ts
export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const url = new URL(request.url);
  const projectId = Number(url.searchParams.get("project"));
  if (!projectId) return new Response(JSON.stringify({ error: { code: "MISSING_PROJECT" } }), { status: 400, headers: { "Content-Type": "application/json" } });
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(projectId, u.id).first();
    if (!m) return new Response("forbidden", { status: 403 });
  }
  const rows = await env.DB.prepare("SELECT * FROM tags WHERE project_id = ? ORDER BY name").bind(projectId).all();
  return new Response(JSON.stringify({ items: rows.results ?? [] }), { headers: { "Content-Type": "application/json" } });
};

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const body = (await request.json().catch(() => null)) as { project_id?: number; name?: string; color?: string } | null;
  if (!body?.project_id || !body.name) return new Response(JSON.stringify({ error: { code: "BAD_INPUT" } }), { status: 400, headers: { "Content-Type": "application/json" } });
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(body.project_id, u.id).first();
    if (!m) return new Response("forbidden", { status: 403 });
  }
  try {
    const row = await env.DB.prepare(
      "INSERT INTO tags (project_id, name, color, created_at) VALUES (?, ?, ?, ?) RETURNING *",
    ).bind(body.project_id, body.name, body.color ?? null, Date.now()).first();
    return new Response(JSON.stringify({ tag: row }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    if (String(e?.message).includes("UNIQUE")) {
      return new Response(JSON.stringify({ error: { code: "DUP" } }), { status: 409, headers: { "Content-Type": "application/json" } });
    }
    throw e;
  }
};
