// functions/api/users/[id].ts - 修改用户 (admin 改角色 / 用户改自己偏好)
export const onRequestPatch: PagesFunction<{ DB: D1Database }> = async ({ request, env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const targetId = Number(params.id);
  if (u.id !== targetId && u.role !== "admin") {
    return new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
  const body = (await request.json().catch(() => null)) as { role?: string; email_notify_enabled?: number; name?: string } | null;
  if (!body) return new Response(JSON.stringify({ error: { code: "BAD_INPUT" } }), { status: 400, headers: { "Content-Type": "application/json" } });

  const before = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(targetId).first<{ role: string; email_notify_enabled: number; name: string | null }>();
  if (!before) return new Response("not found", { status: 404 });

  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.role !== undefined) {
    if (u.role !== "admin") return new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "只有 admin 能改角色" } }), { status: 403, headers: { "Content-Type": "application/json" } });
    if (!["admin", "tester", "dev"].includes(body.role)) return new Response(JSON.stringify({ error: { code: "BAD_ROLE" } }), { status: 400, headers: { "Content-Type": "application/json" } });
    updates.push("role = ?"); values.push(body.role);
  }
  if (body.email_notify_enabled !== undefined) {
    updates.push("email_notify_enabled = ?"); values.push(body.email_notify_enabled ? 1 : 0);
  }
  if (body.name !== undefined) {
    updates.push("name = ?"); values.push(body.name);
  }
  if (updates.length) {
    values.push(targetId);
    await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

    if (body.role !== undefined && body.role !== before.role) {
      await env.DB.prepare(
        `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, created_at) VALUES (?, 'user.role_changed', 'user', ?, ?, ?)`,
      ).bind(u.id, targetId, JSON.stringify({ from: before.role, to: body.role }), Date.now()).run();
    }
  }
  const after = await env.DB.prepare("SELECT id, email, name, role, email_notify_enabled, created_at, last_seen_at FROM users WHERE id = ?").bind(targetId).first();
  return new Response(JSON.stringify({ user: after }), { headers: { "Content-Type": "application/json" } });
};
