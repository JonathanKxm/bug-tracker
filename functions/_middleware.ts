// functions/_middleware.ts - Cloudflare Pages 中间件
// 职责: 1) Access 用户注入 / 自动注册;2) 受保护路由白名单;3) 把当前用户 id 注入 env._user

export const onRequest: PagesFunction<{
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  ACCESS_AUD: string;
  ACCESS_TEAM_DOMAIN: string;
  DEV_FAKE_USER?: string;
  [k: string]: unknown;
}> = async (context) => {
  const { request, env, next } = context;

  const url = new URL(request.url);
  if (url.pathname === "/api/health") {
    return next();
  }

  let email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!email && env.DEV_FAKE_USER) email = env.DEV_FAKE_USER;
  if (!email) {
    return new Response(
      JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Login required" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  email = email.toLowerCase().trim();
  const name = request.headers.get("Cf-Access-Authenticated-User-Name");

  const existing = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first();

  let user: { id: number; role: string; email: string } | null = null;
  if (existing) {
    user = existing as { id: number; role: string; email: string };
    await env.DB.prepare(
      "UPDATE users SET last_seen_at = ?, name = COALESCE(?, name) WHERE id = ?",
    )
      .bind(Date.now(), name, user.id)
      .run();
  } else {
    const cnt = await env.DB.prepare("SELECT COUNT(*) AS n FROM users")
      .first<{ n: number }>();
    const role = cnt && cnt.n === 0 ? "admin" : "tester";
    const now = Date.now();
    const inserted = await env.DB.prepare(
      `INSERT INTO users (email, name, role, email_notify_enabled, created_at, last_seen_at)
       VALUES (?, ?, ?, 1, ?, ?) RETURNING id, role, email`,
    )
      .bind(email, name, role, now, now)
      .first<{ id: number; role: string; email: string }>();
    user = inserted;
  }

  if (!user) {
    return new Response(
      JSON.stringify({ error: { code: "AUTH_FAIL", message: "Cannot create user" } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // 把当前用户 id 注入到 env(下游 handler 通过 env._user 读取)
  (env as Record<string, unknown>)._user = user;

  return next();
};
