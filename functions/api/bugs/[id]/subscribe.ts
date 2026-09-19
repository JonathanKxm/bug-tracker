// functions/api/bugs/[id]/subscribe.ts - 订阅 / 取消订阅
export const onRequestPost: PagesFunction<{ DB: D1Database }> = async ({ env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);
  const bug = await env.DB.prepare("SELECT project_id FROM bugs WHERE id = ?").bind(id).first<{ project_id: number }>();
  if (!bug) return new Response("not found", { status: 404 });
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(bug.project_id, u.id).first();
    if (!m) return new Response("forbidden", { status: 403 });
  }
  await env.DB.prepare("INSERT OR IGNORE INTO bug_subscriptions (bug_id, user_id, subscribed_at) VALUES (?, ?, ?)")
    .bind(id, u.id, Date.now()).run();
  return new Response(JSON.stringify({ subscribed: true }), { headers: { "Content-Type": "application/json" } });
};

export const onRequestDelete: PagesFunction<{ DB: D1Database }> = async ({ env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);
  await env.DB.prepare("DELETE FROM bug_subscriptions WHERE bug_id = ? AND user_id = ?").bind(id, u.id).run();
  return new Response(JSON.stringify({ subscribed: false }), { headers: { "Content-Type": "application/json" } });
};
