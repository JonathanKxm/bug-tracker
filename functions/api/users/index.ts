// functions/api/users/index.ts - 用户列表 (admin)
export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  if (u.role !== "admin") return new Response("forbidden", { status: 403 });
  const users = await env.DB.prepare(
    "SELECT id, email, name, role, email_notify_enabled, created_at, last_seen_at FROM users ORDER BY email",
  ).all();
  return new Response(JSON.stringify({ items: users.results ?? [] }), {
    headers: { "Content-Type": "application/json" },
  });
};
