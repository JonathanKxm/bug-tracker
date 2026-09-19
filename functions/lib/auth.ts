// functions/lib/auth.ts - Access JWT 验证 + 首位用户升级 admin

import type { Env, User, Role } from "../types";

/**
 * Cloudflare Access 在每个请求里通过 header 注入已登录用户信息:
 *   - Cf-Access-Jwt-Assertion: JWT (我们验证签名)
 *   - Cf-Access-Authenticated-User-Email: 邮箱 (开发环境兜底)
 *
 * 这里采用最简方案: 用 HMAC 校验太弱,生产应拉取 Access 公钥 (JWKS) 验证 JWT。
 * 当前实现: 直接信任 Cf-Access-* header (在 Cloudflare 边缘这一头注入,可信),
 * 然后自动同步到 users 表,首位用户升级 admin。
 */

export interface AuthContext {
  user: User;
}

export async function getAuthContext(
  req: Request,
  env: Env,
): Promise<AuthContext | null> {
  const headers = req.headers;
  let email = headers.get("Cf-Access-Authenticated-User-Email");

  // 本地开发兜底: 用 DEV_FAKE_USER
  if (!email && env.DEV_FAKE_USER) {
    email = env.DEV_FAKE_USER;
  }

  if (!email) return null;

  return await syncUser(email, headers.get("Cf-Access-Authenticated-User-Name"), env);
}

async function syncUser(
  email: string,
  name: string | null,
  env: Env,
): Promise<{ user: User }> {
  email = email.toLowerCase().trim();

  const existing = await env.DB.prepare(
    "SELECT * FROM users WHERE email = ?",
  )
    .bind(email)
    .first<User>();

  if (existing) {
    await env.DB.prepare(
      "UPDATE users SET last_seen_at = ?, name = COALESCE(?, name) WHERE id = ?",
    )
      .bind(Date.now(), name, existing.id)
      .run();
    return { user: { ...existing, last_seen_at: Date.now(), name: name ?? existing.name } };
  }

  // 新用户: 首位升级 admin
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS n FROM users")
    .first<{ n: number }>();
  const role: Role = countRow && countRow.n === 0 ? "admin" : "tester";

  const now = Date.now();
  const result = await env.DB.prepare(
    `INSERT INTO users (email, name, role, email_notify_enabled, created_at, last_seen_at)
     VALUES (?, ?, ?, 1, ?, ?) RETURNING *`,
  )
    .bind(email, name, role, now, now)
    .first<User>();

  if (!result) throw new Error("User insert failed");
  return { user: result };
}

/**
 * 角色/资源访问校验
 */
export async function requireProjectAccess(
  userId: number,
  projectId: number,
  env: Env,
): Promise<"admin" | "member" | "none"> {
  const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?")
    .bind(userId)
    .first<{ role: Role }>();
  if (!user) return "none";
  if (user.role === "admin") return "admin";

  const member = await env.DB.prepare(
    "SELECT 1 AS x FROM project_members WHERE project_id = ? AND user_id = ?",
  )
    .bind(projectId, userId)
    .first();
  return member ? "member" : "none";
}

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

export function jsonError(status: number, message: string, code?: string): Response {
  return json({ error: { message, code: code ?? "ERR" } }, { status });
}
