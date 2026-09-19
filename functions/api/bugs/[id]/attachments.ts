// functions/api/bugs/[id]/attachments.ts - 上传附件 (multipart/form-data)
import { MAX_UPLOAD_BYTES, validateUpload } from "../../../lib/upload";

export const onRequestGet: PagesFunction<{ DB: D1Database; ATTACHMENTS: R2Bucket }> = async ({ env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);
  const bug = await env.DB.prepare("SELECT project_id FROM bugs WHERE id = ?").bind(id).first<{ project_id: number }>();
  if (!bug) return new Response("not found", { status: 404 });
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(bug.project_id, u.id).first();
    if (!m) return new Response("forbidden", { status: 403 });
  }
  const rows = await env.DB.prepare("SELECT id, filename, content_type, size, uploaded_by, uploaded_at FROM attachments WHERE bug_id = ? ORDER BY uploaded_at DESC").bind(id).all();
  return new Response(JSON.stringify({ items: rows.results ?? [] }), { headers: { "Content-Type": "application/json" } });
};

export const onRequestPost: PagesFunction<{ DB: D1Database; ATTACHMENTS: R2Bucket }> = async ({ request, env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);

  // 大小硬限 (即使 multipart 全部进来前先看 Content-Length)
  const cl = Number(request.headers.get("Content-Length") ?? "0");
  if (cl > MAX_UPLOAD_BYTES + 1024) {
    return new Response(JSON.stringify({ error: { code: "TOO_LARGE" } }), {
      status: 413, headers: { "Content-Type": "application/json" },
    });
  }

  const bug = await env.DB.prepare("SELECT project_id FROM bugs WHERE id = ?").bind(id).first<{ project_id: number }>();
  if (!bug) return new Response("not found", { status: 404 });
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(bug.project_id, u.id).first();
    if (!m) return new Response("forbidden", { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: { code: "NO_FILE" } }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const v = validateUpload({ name: file.name, type: file.type, size: file.size });
  if (!v.ok) {
    return new Response(JSON.stringify({ error: { code: v.code, message: v.message } }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const r2Key = `bugs/${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await env.ATTACHMENTS.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  const inserted = await env.DB.prepare(
    `INSERT INTO attachments (bug_id, r2_key, filename, content_type, size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(id, r2Key, file.name, file.type, file.size, u.id, Date.now()).first<{ id: number }>();

  return new Response(JSON.stringify({ id: inserted!.id, r2_key: r2Key }), { status: 201, headers: { "Content-Type": "application/json" } });
};
