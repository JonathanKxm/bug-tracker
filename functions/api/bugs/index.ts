// functions/api/bugs/index.ts
// GET  - 列表 + 全文搜索 + 分页 + 排序 + 标签过滤
// POST - 创建 bug (Bug 编号自动生成)
import type { BugStatus, Severity } from "../../types";

const SORT_COLUMNS: Record<string, string> = {
  created_at: "created_at",
  updated_at: "updated_at",
  severity: "severity",
  status: "status",
  bug_number: "bug_number",
};

const SEVERITY_ORDER: Severity[] = ["low", "medium", "high", "critical"];

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const url = new URL(request.url);

  const projectId = Number(url.searchParams.get("project"));
  if (!projectId) return new Response(JSON.stringify({ error: { code: "MISSING_PROJECT" } }), { status: 400, headers: { "Content-Type": "application/json" } });

  // 校验访问
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(projectId, u.id).first();
    if (!m) return new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize")) || 20));
  const offset = (page - 1) * pageSize;

  // 排序
  const sortRaw = url.searchParams.get("sort") ?? "-updated_at";
  const desc = sortRaw.startsWith("-");
  const sortKey = desc ? sortRaw.slice(1) : sortRaw;
  const col = SORT_COLUMNS[sortKey] ?? "updated_at";
  let orderBy = `${col} ${desc ? "DESC" : "ASC"}`;
  if (col === "severity") {
    // severity 自定义排序: critical → low, 借助 CASE
    const clause = SEVERITY_ORDER.map((s, i) => `WHEN '${s}' THEN ${i}`).join(" ");
    orderBy = `(CASE severity ${clause} ELSE 99 END) ${desc ? "DESC" : "ASC"}`;
  }

  const q = url.searchParams.get("q")?.trim() || "";
  const status = url.searchParams.get("status") as BugStatus | null;
  const assigneeId = url.searchParams.get("assignee");
  const includeDeleted = url.searchParams.get("includeDeleted") === "1" && u.role === "admin";
  const tagIds = (url.searchParams.getAll("tag") ?? []).map(Number).filter(Boolean);

  // 构建 WHERE
  const where: string[] = ["b.project_id = ?"];
  const params: unknown[] = [projectId];

  if (!includeDeleted) where.push("b.deleted_at IS NULL");
  if (q) {
    where.push("(LOWER(b.title) LIKE ? OR LOWER(b.description) LIKE ?)");
    const qPattern = `%${q.toLowerCase()}%`;
    params.push(qPattern, qPattern);
  }
  if (status) { where.push("b.status = ?"); params.push(status); }
  if (assigneeId) { where.push("b.assignee_id = ?"); params.push(Number(assigneeId)); }

  let joinClause = "";
  if (tagIds.length) {
    joinClause = `JOIN bug_tags bt ON bt.bug_id = b.id AND bt.tag_id IN (${tagIds.map(() => "?").join(",")})`;
    params.push(...tagIds);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // 总数 (独立查询)
  const countRow = await env.DB.prepare(
    `SELECT COUNT(DISTINCT b.id) AS total FROM bugs b ${joinClause} ${whereSql}`,
  ).bind(...params).first<{ total: number }>();

  const items = await env.DB.prepare(`
    SELECT
      b.*,
      ru.name AS reporter_name, ru.email AS reporter_email,
      au.name AS assignee_name, au.email AS assignee_email
    FROM bugs b
    LEFT JOIN users ru ON ru.id = b.reporter_id
    LEFT JOIN users au ON au.id = b.assignee_id
    ${joinClause}
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).bind(...params, pageSize, offset).all();

  // 标签
  const ids = (items.results ?? []).map((b: any) => b.id);
  let tagMap = new Map<number, { id: number; name: string; color: string | null }[]>();
  if (ids.length) {
    const tagRows = await env.DB.prepare(`
      SELECT bt.bug_id, t.id, t.name, t.color
      FROM bug_tags bt JOIN tags t ON t.id = bt.tag_id
      WHERE bt.bug_id IN (${ids.map(() => "?").join(",")})
    `).bind(...ids).all<{ bug_id: number; id: number; name: string; color: string | null }>();
    for (const t of tagRows.results ?? []) {
      const arr = tagMap.get(t.bug_id) ?? [];
      arr.push({ id: t.id, name: t.name, color: t.color });
      tagMap.set(t.bug_id, arr);
    }
  }

  const enriched = (items.results ?? []).map((b: any) => ({ ...b, tags: tagMap.get(b.id) ?? [] }));

  const total = countRow?.total ?? 0;
  return new Response(JSON.stringify({
    items: enriched,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  }), { headers: { "Content-Type": "application/json" } });
};

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async ({ request, env }) => {
  const u = (env as unknown as { _user: { id: number; role: string } })._user!;
  const body = (await request.json().catch(() => null)) as {
    project_id?: number;
    title?: string;
    description?: string;
    severity?: Severity;
    assignee_id?: number | null;
    due_at?: number | null;
    tag_ids?: number[];
  } | null;

  if (!body?.project_id || !body.title || !body.description || !body.severity) {
    return new Response(JSON.stringify({ error: { code: "BAD_INPUT", message: "缺少必要字段" } }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  if (!["low", "medium", "high", "critical"].includes(body.severity)) {
    return new Response(JSON.stringify({ error: { code: "BAD_SEVERITY" } }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // 访问校验
  if (u.role !== "admin") {
    const m = await env.DB.prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
      .bind(body.project_id, u.id).first();
    if (!m) return new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  // 并发安全的 bug_number 生成: 重试最多少量几次
  let bugId: number | null = null;
  let bugNumber: number | null = null;
  for (let i = 0; i < 5; i++) {
    const last = await env.DB.prepare("SELECT MAX(bug_number) AS n FROM bugs WHERE project_id = ? AND deleted_at IS NULL")
      .bind(body.project_id).first<{ n: number | null }>();
    const candidate = (last?.n ?? 0) + 1;
    const now = Date.now();
    const status = body.assignee_id ? "assigned" : "open";
    try {
      const inserted = await env.DB.prepare(
        `INSERT INTO bugs (project_id, bug_number, title, description, severity, status, reporter_id, assignee_id, due_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, bug_number`,
      ).bind(
        body.project_id, candidate, body.title, body.description, body.severity,
        status, u.id, body.assignee_id ?? null, body.due_at ?? null, now, now,
      ).first<{ id: number; bug_number: number }>();
      if (!inserted) throw new Error("Insert returned no row");
      bugId = inserted.id;
      bugNumber = inserted.bug_number;
      break;
    } catch (e: any) {
      if (String(e?.message).includes("UNIQUE")) continue; // 重试
      throw e;
    }
  }
  if (bugId == null || bugNumber == null) {
    return new Response(JSON.stringify({ error: { code: "RACE", message: "编号生成失败,请重试" } }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }

  // 初始 history
  await env.DB.prepare(
    `INSERT INTO bug_history (bug_id, from_status, to_status, changed_by, note, changed_at) VALUES (?, NULL, 'open', ?, ?, ?)`,
  ).bind(bugId, u.id, "创建", Date.now()).run();

  // 标签
  if (body.tag_ids && body.tag_ids.length) {
    await env.DB.batch(
      body.tag_ids.map((tid) =>
        env.DB.prepare("INSERT OR IGNORE INTO bug_tags (bug_id, tag_id) VALUES (?, ?)").bind(bugId, tid),
      ),
    );
  }

  // 通知: assignee -> bug_assigned
  if (body.assignee_id && body.assignee_id !== u.id) {
    const project = await env.DB.prepare("SELECT `key`, name FROM projects WHERE id = ?").bind(body.project_id).first<{ key: string; name: string }>();
    const text = `${project?.name ?? ""} ${project?.key}-${bugNumber}`;
    await env.DB.prepare(
      `INSERT INTO notifications (user_id, type, bug_id, actor_id, title, body, read_at, email_sent_at, created_at)
       VALUES (?, 'bug_assigned', ?, ?, ?, ?, NULL, NULL, ?)`,
    ).bind(body.assignee_id, bugId, u.id, `指派给你 ${text}`, body.title, Date.now()).run();
  }

  return new Response(JSON.stringify({ id: bugId!, bug_number: bugNumber! }), {
    status: 201, headers: { "Content-Type": "application/json" },
  });
};
