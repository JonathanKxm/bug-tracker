// functions/api/bugs/[id]/tags.ts - bug 上设置标签
export const onRequestPut: PagesFunction<{ DB: D1Database }> = async ({ request, env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);
  const bug = await env.DB.prepare("SELECT project_id FROM bugs WHERE id = ?").bind(id).first<{ project_id: number }>();
  if (!bug) return new Response("not found", { status: 404 });
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(bug.project_id, u.id).first();
    if (!m) return new Response("forbidden", { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { tag_ids?: number[] } | null;
  const tagIds = Array.isArray(body?.tag_ids) ? body!.tag_ids : [];
  await env.DB.prepare("DELETE FROM bug_tags WHERE bug_id = ?").bind(id).run();
  if (tagIds.length) {
    await env.DB.batch(
      tagIds.map((tid) => env.DB.prepare("INSERT INTO bug_tags (bug_id, tag_id) VALUES (?, ?)").bind(id, tid)),
    );
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};
