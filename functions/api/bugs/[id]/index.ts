// functions/api/bugs/[id]/index.ts
// GET - 详情
// PATCH - 更新字段 (状态变更/严重度/分配)
// DELETE - 软删除
// 注意: POST -> /api/bugs/[id]/restore 由 [id]/restore.ts 处理

import { canRoleTransition, describeTransition } from "../../../lib/permissions";
import { notify, getStatusChangeRecipients } from "../../../lib/notify";
import type { Bug, BugStatus } from "../../../types";

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env, params, request }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);
  const url = new URL(request.url);

  const includeDeleted = url.searchParams.get("includeDeleted") === "1";
  const bug = await env.DB.prepare("SELECT * FROM bugs WHERE id = ?")
    .bind(id).first<Bug>();
  if (!bug) return new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404, headers: { "Content-Type": "application/json" } });
  if (bug.deleted_at && !includeDeleted) {
    return new Response(JSON.stringify({ error: { code: "DELETED" } }), { status: 410, headers: { "Content-Type": "application/json" } });
  }

  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(bug.project_id, u.id).first();
    if (!m) return new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const [reporter, assignee, comments, history, tags, attachments] = await Promise.all([
    env.DB.prepare("SELECT id, email, name FROM users WHERE id = ?").bind(bug.reporter_id).first(),
    bug.assignee_id ? env.DB.prepare("SELECT id, email, name FROM users WHERE id = ?").bind(bug.assignee_id).first() : null,
    env.DB.prepare(`
      SELECT c.*, u.name AS author_name, u.email AS author_email
      FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.bug_id = ? ORDER BY c.created_at
    `).bind(id).all(),
    env.DB.prepare(`
      SELECT h.*, u.name AS changed_by_name
      FROM bug_history h JOIN users u ON u.id = h.changed_by
      WHERE h.bug_id = ? ORDER BY h.changed_at
    `).bind(id).all(),
    env.DB.prepare(`
      SELECT t.id, t.name, t.color FROM tags t
      JOIN bug_tags bt ON bt.tag_id = t.id
      WHERE bt.bug_id = ?
    `).bind(id).all(),
    env.DB.prepare("SELECT id, filename, content_type, size, uploaded_by, uploaded_at FROM attachments WHERE bug_id = ? ORDER BY uploaded_at").bind(id).all(),
  ]);

  return new Response(JSON.stringify({
    bug,
    reporter,
    assignee,
    comments: comments.results ?? [],
    history: history.results ?? [],
    tags: tags.results ?? [],
    attachments: attachments.results ?? [],
  }), { headers: { "Content-Type": "application/json" } });
};

export const onRequestPatch: PagesFunction<{
  DB: D1Database;
  EMAIL?: { send: (m: { from: string; to: string; subject: string; text: string }) => Promise<void> };
}> = async ({ request, env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);
  const bug = await env.DB.prepare("SELECT * FROM bugs WHERE id = ?").bind(id).first<Bug>();
  if (!bug || bug.deleted_at) return new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404, headers: { "Content-Type": "application/json" } });

  // 访问校验
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(bug.project_id, u.id).first();
    if (!m) return new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const body = (await request.json().catch(() => null)) as {
    status?: BugStatus;
    severity?: string;
    assignee_id?: number | null;
    title?: string;
    description?: string;
    note?: string;
    due_at?: number | null;
  } | null;
  if (!body) return new Response(JSON.stringify({ error: { code: "BAD_INPUT" } }), { status: 400, headers: { "Content-Type": "application/json" } });

  const updates: string[] = [];
  const values: unknown[] = [];

  // 状态变更
  if (body.status && body.status !== bug.status) {
    if (!canRoleTransition(u.role as any, bug.status, body.status)) {
      return new Response(JSON.stringify({ error: { code: "BAD_TRANSITION", message: `${u.role} 无权从 ${bug.status} 变更为 ${body.status}` } }), {
        status: 403, headers: { "Content-Type": "application/json" },
      });
    }
    updates.push("status = ?"); values.push(body.status);
    if (body.status === "closed" || body.status === "fixed") {
      updates.push("resolved_at = ?"); values.push(Date.now());
    } else if (bug.status === "closed" && body.status === "reopened") {
      updates.push("resolved_at = NULL");
    }
  }

  if (body.severity !== undefined) {
    if (!["low", "medium", "high", "critical"].includes(body.severity)) {
      return new Response(JSON.stringify({ error: { code: "BAD_SEVERITY" } }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (body.severity !== bug.severity) {
      if (u.role !== "admin") return new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "只有 admin 能改严重度" } }), { status: 403, headers: { "Content-Type": "application/json" } });
      updates.push("severity = ?"); values.push(body.severity);
    }
  }
  if (body.assignee_id !== undefined && body.assignee_id !== bug.assignee_id) {
    updates.push("assignee_id = ?"); values.push(body.assignee_id);
  }
  if (body.title !== undefined) { updates.push("title = ?"); values.push(body.title); }
  if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description); }
  if (body.due_at !== undefined) { updates.push("due_at = ?"); values.push(body.due_at); }

  if (!updates.length && !body.note) {
    return new Response(JSON.stringify({ ok: true, unchanged: true }), { headers: { "Content-Type": "application/json" } });
  }

  updates.push("updated_at = ?"); values.push(Date.now());
  values.push(id);
  await env.DB.prepare(`UPDATE bugs SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

  // 历史记录
  if (body.status && body.status !== bug.status) {
    await env.DB.prepare(
      `INSERT INTO bug_history (bug_id, from_status, to_status, changed_by, note, changed_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(id, bug.status, body.status, u.id, body.note ?? null, Date.now()).run();
  } else if (body.assignee_id !== undefined && body.assignee_id !== bug.assignee_id) {
    await env.DB.prepare(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, created_at) VALUES (?, 'bug.reassigned', 'bug', ?, ?, ?)`,
    ).bind(u.id, id, JSON.stringify({ from: bug.assignee_id, to: body.assignee_id }), Date.now()).run();
  }
  if (body.severity && body.severity !== bug.severity) {
    await env.DB.prepare(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, created_at) VALUES (?, 'bug.severity_changed', 'bug', ?, ?, ?)`,
    ).bind(u.id, id, JSON.stringify({ from: bug.severity, to: body.severity }), Date.now()).run();
  }

  // 通知
  if (body.status && body.status !== bug.status) {
    const recipients = await getStatusChangeRecipients(env as any, id, body.assignee_id ?? null);
    const project = await env.DB.prepare("SELECT `key`, name FROM projects WHERE id = ?").bind(bug.project_id).first<{ key: string; name: string }>();
    const refName = `${project?.key ?? ""}-${bug.bug_number}`;
    const newBug = await env.DB.prepare("SELECT * FROM bugs WHERE id = ?").bind(id).first<Bug>();
    if (newBug) {
      await notify(env as any, {
        type: body.status === "reopened" ? "bug_reopened" : "bug_status_changed",
        bugId: id,
        actorId: u.id,
        recipientIds: recipients,
        title: `${refName} 状态变更为 ${body.status}`,
        body: `${describeTransition(bug.status, body.status)}: ${newBug.title}${body.note ? `\n${body.note}` : ""}`,
      });
    }
  }
  if (body.assignee_id !== undefined && body.assignee_id !== bug.assignee_id && body.assignee_id) {
    const project = await env.DB.prepare("SELECT `key`, name FROM projects WHERE id = ?").bind(bug.project_id).first<{ key: string; name: string }>();
    const refName = `${project?.key ?? ""}-${bug.bug_number}`;
    await notify(env as any, {
      type: "bug_assigned",
      bugId: id,
      actorId: u.id,
      recipientIds: [body.assignee_id],
      title: `指派给你 ${refName}`,
      body: bug.title,
    });
  }

  const after = await env.DB.prepare("SELECT * FROM bugs WHERE id = ?").bind(id).first<Bug>();
  return new Response(JSON.stringify({ bug: after }), { headers: { "Content-Type": "application/json" } });
};

export const onRequestDelete: PagesFunction<{ DB: D1Database }> = async ({ env, params, request }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  const bug = await env.DB.prepare("SELECT * FROM bugs WHERE id = ?").bind(id).first<Bug>();
  if (!bug) return new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404, headers: { "Content-Type": "application/json" } });
  if (bug.deleted_at && !force) return new Response("already deleted", { status: 410 });

  if (u.role !== "admin" && bug.reporter_id !== u.id) {
    return new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "只有 admin 或 reporter 能删除" } }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  await env.DB.prepare("UPDATE bugs SET deleted_at = ?, updated_at = ? WHERE id = ?")
    .bind(Date.now(), Date.now(), id).run();

  await env.DB.prepare(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, created_at) VALUES (?, 'bug.deleted', 'bug', ?, ?, ?)`,
  ).bind(u.id, id, JSON.stringify({ bug_number: bug.bug_number }), Date.now()).run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};
