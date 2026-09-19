// functions/api/notifications/index.ts
export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env, request }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const url = new URL(request.url);
  const onlyUnread = url.searchParams.get("unread") === "1";
  const limit = Math.min(50, Number(url.searchParams.get("limit")) || 20);

  const rows = await env.DB.prepare(
    onlyUnread
      ? "SELECT * FROM notifications WHERE user_id = ? AND read_at IS NULL ORDER BY created_at DESC LIMIT ?"
      : "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
  ).bind(u.id, limit).all();

  const unreadCount = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL",
  ).bind(u.id).first<{ n: number }>();

  return new Response(JSON.stringify({ items: rows.results ?? [], unread: unreadCount?.n ?? 0 }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  // 批量标记已读
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const body = (await request.json().catch(() => null)) as { ids?: number[]; all?: boolean } | null;
  if (!body) return new Response(JSON.stringify({ error: { code: "BAD_INPUT" } }), { status: 400, headers: { "Content-Type": "application/json" } });
  if (body.all) {
    await env.DB.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").bind(Date.now(), u.id).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }
  if (!body.ids?.length) return new Response(JSON.stringify({ error: { code: "BAD_INPUT" } }), { status: 400, headers: { "Content-Type": "application/json" } });
  await env.DB.batch(body.ids.map((id) => env.DB.prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?").bind(Date.now(), id, u.id)));
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};
