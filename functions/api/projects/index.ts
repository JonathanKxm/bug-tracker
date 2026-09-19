// functions/api/projects/index.ts - 项目列表 / 创建
import type { Project, User } from "../../types";

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const u = (env as unknown as { _user: User })._user!;
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";

  let projects;
  if (u.role === "admin") {
    projects = await env.DB.prepare(
      includeArchived
        ? "SELECT * FROM projects ORDER BY archived, name"
        : "SELECT * FROM projects WHERE archived = 0 ORDER BY name",
    ).all<Project>();
  } else {
    projects = await env.DB.prepare(
      `SELECT p.* FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = ? AND p.archived = 0
       ORDER BY p.name`,
    ).bind(u.id).all<Project>();
  }

  return new Response(JSON.stringify({ items: projects.results ?? [] }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const u = (env as unknown as { _user: User })._user!;
  if (u.role !== "admin") {
    return new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "管理员才能创建项目" } }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await request.json().catch(() => null)) as { name?: string; key?: string; description?: string } | null;
  if (!body || !body.name || !body.key) {
    return new Response(JSON.stringify({ error: { code: "BAD_INPUT", message: "需要 name 和 key" } }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  const key = body.key.toUpperCase();
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
    return new Response(JSON.stringify({ error: { code: "BAD_KEY", message: "key 必须是 2-10 位字母数字,首字符为字母" } }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO projects (name, key, description, created_by, created_at) VALUES (?, ?, ?, ?, ?)
       RETURNING *`,
    ).bind(body.name, key, body.description ?? null, u.id, Date.now()).first<Project>();

    // 自动把创建者加入项目
    await env.DB.prepare(
      "INSERT INTO project_members (project_id, user_id, project_role, added_at) VALUES (?, ?, 'developer', ?)",
    ).bind(result!.id, u.id, Date.now()).run();

    await env.DB.prepare(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, created_at) VALUES (?, 'project.created', 'project', ?, ?, ?)`,
    ).bind(u.id, result!.id, JSON.stringify({ name: body.name, key }), Date.now()).run();

    return new Response(JSON.stringify({ project: result }), {
      status: 201, headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (String(e?.message ?? "").includes("UNIQUE")) {
      return new Response(JSON.stringify({ error: { code: "KEY_TAKEN", message: "key 已被使用" } }), {
        status: 409, headers: { "Content-Type": "application/json" },
      });
    }
    throw e;
  }
};
