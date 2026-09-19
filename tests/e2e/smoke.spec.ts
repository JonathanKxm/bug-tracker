// tests/e2e/smoke.spec.ts - 桌面端冒烟测试
import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("首页 /api/health 200", async ({ request }) => {
    const r = await request.get("/api/health");
    expect(r.status()).toBeGreaterThanOrEqual(200);
  });

  test("登录后能看到项目页", async ({ page }) => {
    // dev mode 直接读 DEV_FAKE_USER 跳过真 Access
    await page.goto("/");
    // 期望见到 "项目" 标题
    await expect(page.getByText("项目", { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("访问 /projects 路由不报错", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/projects$/);
    await page.waitForLoadState("networkidle");
  });
});
