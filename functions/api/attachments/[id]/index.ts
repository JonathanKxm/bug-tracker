// functions/api/attachments/[id]/index.ts - 下载附件
import type { Attachment } from "../../../types";

export const onRequestGet: PagesFunction<{ DB: D1Database; ATTACHMENTS: R2Bucket }> = async ({ env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);
  const att = await env.DB.prepare("SELECT * FROM attachments WHERE id = ?").bind(id).first<Attachment>();
  if (!att) return new Response("not found", { status: 404 });

  const bug = await env.DB.prepare("SELECT project_id FROM bugs WHERE id = ?").bind(att.bug_id).first<{ project_id: number }>();
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(bug!.project_id, u.id).first();
    if (!m) return new Response("forbidden", { status: 403 });
  }
  const obj = await env.ATTACHMENTS.get(att.r2_key);
  if (!obj) return new Response("not found in storage", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "Content-Type": att.content_type ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(att.filename)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
};
