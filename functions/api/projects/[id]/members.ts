// functions/api/projects/[id]/members.ts - 成员增删
export const onRequestPost: PagesFunction<{ DB: D1Database }> = async ({ request, env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  if (u.role !== "admin") return new Response("forbidden", { status: 403 });
  const projectId = Number(params.id);
  const body = (await request.json().catch(() => null)) as { email?: string; project_role?: string } | null;
  if (!body?.email) return new Response("missing email", { status: 400 });
  const target = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(body.email.toLowerCase()).first<{ id: number }>();
  if (!target) return new Response(JSON.stringify({ error: { code: "USER_NOT_FOUND" } }), { status: 404, headers: { "Content-Type": "application/json" } });
  await env.DB.prepare(
    "INSERT OR IGNORE INTO project_members (project_id, user_id, project_role, added_at) VALUES (?, ?, ?, ?)",
  ).bind(projectId, target.id, body.project_role ?? "developer", Date.now()).run();
  await env.DB.prepare(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, created_at) VALUES (?, 'project.member_added', 'project', ?, ?, ?)`,
  ).bind(u.id, projectId, JSON.stringify({ user_id: target.id }), Date.now()).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};

export const onRequestDelete: PagesFunction<{ DB: D1Database }> = async ({ request, env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  if (u.role !== "admin") return new Response("forbidden", { status: 403 });
  const projectId = Number(params.id);
  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("userId"));
  if (!userId) return new Response("missing userId", { status: 400 });
  await env.DB.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?").bind(projectId, userId).run();
  await env.DB.prepare(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, created_at) VALUES (?, 'project.member_removed', 'project', ?, ?, ?)`,
  ).bind(u.id, projectId, JSON.stringify({ user_id: userId }), Date.now()).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};
