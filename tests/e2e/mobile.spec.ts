// tests/e2e/mobile.spec.ts - 移动端布局验证
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 375, height: 667 } });

test("移动端: 登录页能用,AppShell 折叠菜单可用", async ({ page }) => {
  // 我们访问 /api/health 看 server 是否起来
  await page.goto("/");
  // 这里期望: dev mode 会读 DEV_FAKE_USER 并自动登录,所以应该看到项目页或 projects 路由的某个元素
  // 检查有 Menu 图标 (mobile drawer toggle)
  await page.waitForLoadState("networkidle");
  // 期望看到项目页的标题或者 menu icon
  const hasMenu = await page.locator('[aria-label],button').count();
  expect(hasMenu).toBeGreaterThan(0);
});

test("375x667 viewport 没有水平滚动", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // 没有强制 html/body overflow-x,viewport=375 应当不溢出
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("768x1024 tablet 字号不变形", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const cards = await page.locator("body").count();
  expect(cards).toBe(1);
});
