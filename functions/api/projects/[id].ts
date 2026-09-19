// functions/api/projects/[id].ts - 项目详情 / 更新(归档/改名)
import type { Project } from "../../types";

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const id = Number(params.id);
  const project = await env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id).first<Project>();
  if (!project) return new Response("not found", { status: 404 });

  if (u.role !== "admin") {
    const member = await env.DB.prepare(
      "SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?",
    ).bind(id, u.id).first();
    if (!member) return new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const members = await env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.role, pm.project_role, pm.added_at
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
    ORDER BY pm.added_at
  `).bind(id).all();

  return new Response(JSON.stringify({ project, members: members.results ?? [] }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestPatch: PagesFunction<{ DB: D1Database }> = async ({ request, env, params }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  if (u.role !== "admin") {
    return new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
  const id = Number(params.id);
  const body = (await request.json().catch(() => null)) as { archived?: number; name?: string; description?: string } | null;
  if (!body) return new Response(JSON.stringify({ error: { code: "BAD_INPUT" } }), { status: 400, headers: { "Content-Type": "application/json" } });

  const existing = await env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first<Project>();
  if (!existing) return new Response("not found", { status: 404 });

  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.archived !== undefined) { updates.push("archived = ?"); values.push(body.archived ? 1 : 0); }
  if (body.name !== undefined) { updates.push("name = ?"); values.push(body.name); }
  if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description); }

  if (updates.length) {
    values.push(id);
    await env.DB.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    await env.DB.prepare(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, created_at) VALUES (?, ?, 'project', ?, ?, ?)`,
    ).bind(u.id, body.archived !== undefined ? "project.archived" : "project.updated", id, JSON.stringify({ before: existing, after: body }), Date.now()).run();
  }
  const after = await env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first<Project>();
  return new Response(JSON.stringify({ project: after }), { headers: { "Content-Type": "application/json" } });
};
