// functions/api/bugs/[id]/comments.ts
export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);
  const bug = await env.DB.prepare("SELECT project_id FROM bugs WHERE id = ?").bind(id).first<{ project_id: number }>();
  if (!bug) return new Response("not found", { status: 404 });
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(bug.project_id, u.id).first();
    if (!m) return new Response("forbidden", { status: 403 });
  }
  const rows = await env.DB.prepare(`
    SELECT c.*, u.name AS author_name, u.email AS author_email
    FROM comments c JOIN users u ON u.id = c.author_id
    WHERE c.bug_id = ? ORDER BY c.created_at
  `).bind(id).all();
  return new Response(JSON.stringify({ items: rows.results ?? [] }), { headers: { "Content-Type": "application/json" } });
};

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async ({ request, env, params, waitUntil }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);
  const body = (await request.json().catch(() => null)) as { content?: string } | null;
  if (!body?.content?.trim()) return new Response(JSON.stringify({ error: { code: "EMPTY" } }), { status: 400, headers: { "Content-Type": "application/json" } });

  const bug = await env.DB.prepare("SELECT * FROM bugs WHERE id = ?").bind(id).first<{ project_id: number; reporter_id: number; assignee_id: number | null; title: string; bug_number: number }>();
  if (!bug) return new Response("not found", { status: 404 });

  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(bug.project_id, u.id).first();
    if (!m) return new Response("forbidden", { status: 403 });
  }

  const inserted = await env.DB.prepare(
    `INSERT INTO comments (bug_id, author_id, content, created_at) VALUES (?, ?, ?, ?) RETURNING id`,
  ).bind(id, u.id, body.content, Date.now()).first<{ id: number }>();

  // 通知
  const recipients = new Set<number>();
  recipients.add(bug.reporter_id);
  if (bug.assignee_id) recipients.add(bug.assignee_id);
  const subs = await env.DB.prepare("SELECT user_id FROM bug_subscriptions WHERE bug_id = ?").bind(id).all<{ user_id: number }>();
  for (const s of subs.results ?? []) recipients.add(s.user_id);

  waitUntil?.((async () => {
    const envAny = env as any;
    const { notify } = await import("../../../lib/notify");
    await notify(envAny, {
      type: "bug_commented",
      bugId: id,
      actorId: u.id,
      recipientIds: Array.from(recipients),
      title: `新评论 ${bug.title}`,
      body: body.content!.slice(0, 200),
    });
  })());

  return new Response(JSON.stringify({ id: inserted!.id }), { status: 201, headers: { "Content-Type": "application/json" } });
};
