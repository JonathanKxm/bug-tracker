// tests/unit/stateClient.test.ts - 前端权限矩阵必须与后端一致
import { describe, expect, it } from "vitest";
import { canUserTransition, canTransition } from "../../src/lib/stateClient";

describe("前端状态矩阵", () => {
  it("tester 不能做 assigned -> in_progress", () => {
    expect(canUserTransition("tester", "assigned", "in_progress")).toBe(false);
  });
  it("admin 任何合法跳转都允许", () => {
    expect(canUserTransition("admin", "in_progress", "fixed")).toBe(true);
    expect(canUserTransition("admin", "verifying", "closed")).toBe(true);
  });
  it("dev 可以修复", () => {
    expect(canUserTransition("dev", "in_progress", "fixed")).toBe(true);
  });
  it("canTransition 仅判断跳转合法性,与角色无关", () => {
    expect(canTransition("open", "assigned")).toBe(true);
    expect(canTransition("open", "fixed")).toBe(false);
  });
});
