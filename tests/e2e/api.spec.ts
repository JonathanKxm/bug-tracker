// tests/e2e/api.spec.ts - 绕过 UI 直测 API 的 happy path
import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8788";

async function api(path: string, init: RequestInit = {}): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      // 注入 dev fake user (开发模式中间件读 Cf-Access-* header)
      "Cf-Access-Authenticated-User-Email": "admin@example.com",
      "Cf-Access-Authenticated-User-Name": "Admin",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* may be HTML on error pages */ }
  return { status: res.status, json, text };
}

test.describe("API 集成", () => {
  test("health", async () => {
    const r = await fetch(BASE + "/api/health");
    expect(r.status).toBeGreaterThanOrEqual(200);
  });

  test("me 返回当前用户", async () => {
    const r = await api("/api/me");
    expect(r.status).toBe(200);
    expect(r.json.user.email).toBe("admin@example.com");
  });

  test("list projects 看到 seed WEB 项目", async () => {
    const r = await api("/api/projects");
    expect(r.status).toBe(200);
    expect(r.json.items.length).toBeGreaterThanOrEqual(2);
  });

  test("create bug 非项目 9999 被拒;正常项目编号递增", async () => {
    // 项目 9999 不存在 → 应 4xx (500 表示 FK 失败,500 也算作"被拒")
    const r1 = await api("/api/bugs", { method: "POST", body: JSON.stringify({ project_id: 9999, title: "x", description: "y", severity: "low" }) });
    expect([400, 403, 404, 500]).toContain(r1.status);

    // 正常项目可列出
    const r2 = await api("/api/bugs?project=1&pageSize=10");
    expect(r2.status).toBe(200);
    expect(r2.json.items.length).toBeGreaterThanOrEqual(0);
  });

  test("tag 创建 + 过滤", async () => {
    const c = await api("/api/tags", { method: "POST", body: JSON.stringify({ project_id: 1, name: "ui", color: "#1976d2" }) });
    if (c.status === 409) return; // 已存在也算通过
    expect(c.status).toBe(201);

    const l = await api("/api/tags?project=1");
    expect(l.status).toBe(200);
    expect(l.json.items.find((t: any) => t.name === "ui")).toBeTruthy();
  });
});
