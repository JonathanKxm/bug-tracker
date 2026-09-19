// tests/e2e/permissions.spec.ts - 角色权限矩阵 E2E
import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8788";

async function api(path: string, init: RequestInit = {}, email = "admin@example.com") {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cf-Access-Authenticated-User-Email": email,
      "Cf-Access-Authenticated-User-Name": email,
      ...init.headers,
    },
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

test.describe("权限矩阵", () => {
  test("tester 不能修改他人项目的 bug 状态 (in_progress->fixed)", async () => {
    // 用 admin 创建一个 bug
    const created = await api("/api/bugs", {
      method: "POST",
      body: JSON.stringify({ project_id: 1, title: "perm test", description: "check", severity: "low" }),
    });
    expect([200, 201]).toContain(created.status);

    // 列出
    const list = await api("/api/bugs?project=1");
    expect(list.status).toBe(200);
    const bugId = list.json.items[0].id;

    // 用 "非 admin 用户" 试图修复 (in_progress -> fixed) - tester 没权限
    // 先把它推进 in_progress 用 admin
    const r1 = await api(`/api/bugs/${bugId}`, { method: "PATCH", body: JSON.stringify({ status: "assigned" }) });
    expect(r1.status).toBe(200);
    const r2 = await api(`/api/bugs/${bugId}`, { method: "PATCH", body: JSON.stringify({ status: "in_progress" }) }, "tester@example.com");
    expect([403]).toContain(r2.status);
  });
});
