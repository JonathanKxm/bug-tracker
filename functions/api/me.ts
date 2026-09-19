// functions/api/me.ts - 当前用户
export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env }) => {
  const u = (env as unknown as { _user: { id: number; email: string; role: string; name: string | null } })._user;
  if (!u) return new Response("unauthorized", { status: 401 });

  const full = await env.DB.prepare("SELECT id, email, name, role, email_notify_enabled, created_at, last_seen_at FROM users WHERE id = ?")
    .bind(u.id).first();

  const memberships = await env.DB.prepare(`
    SELECT p.id, p.name, p.key, pm.project_role
    FROM project_members pm
    JOIN projects p ON p.id = pm.project_id
    WHERE pm.user_id = ?
    ORDER BY p.name
  `).bind(u.id).all();

  return new Response(JSON.stringify({ user: full, projects: memberships.results ?? [] }), {
    headers: { "Content-Type": "application/json" },
  });
};
