// tests/e2e/_setup.ts - 数据库清空 + 测试 fixture
import { request } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8788";

export async function resetDb(): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE });
  // 通过 cookie 注入 fake user,因 dev env 用 header 也可以
  const res = await ctx.fetch("/api/health");
  if (!res.ok()) throw new Error("Health failed - server not up");
  await ctx.dispose();
}

export const adminEmail = "admin@example.com";
export const testerEmail = "alice@example.com";
export const devEmail = "bob@example.com";
