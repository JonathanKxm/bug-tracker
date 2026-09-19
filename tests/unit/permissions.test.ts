// tests/unit/permissions.test.ts
import { describe, expect, it } from "vitest";
import { canTransition, canRoleTransition, allowedTransitions, describeTransition } from "../../functions/lib/permissions";

describe("状态机转换合法性", () => {
  it("open -> assigned 仅允许 admin", () => {
    expect(canTransition("open", "assigned")).toBe(true);
    expect(canRoleTransition("admin", "open", "assigned")).toBe(true);
    expect(canRoleTransition("tester", "open", "assigned")).toBe(false);
    expect(canRoleTransition("dev", "open", "assigned")).toBe(false);
  });

  it("tester 不能从 assigned 转为 in_progress", () => {
    expect(canRoleTransition("tester", "assigned", "in_progress")).toBe(false);
    expect(canRoleTransition("dev", "assigned", "in_progress")).toBe(true);
  });

  it("dev 可以修复 (in_progress -> fixed)", () => {
    expect(canRoleTransition("dev", "in_progress", "fixed")).toBe(true);
    expect(canRoleTransition("tester", "in_progress", "fixed")).toBe(false);
  });

  it("dev 不能关闭 (verifying -> closed)", () => {
    expect(canRoleTransition("dev", "verifying", "closed")).toBe(false);
    expect(canRoleTransition("tester", "verifying", "closed")).toBe(true);
    expect(canRoleTransition("admin", "verifying", "closed")).toBe(true);
  });

  it("tester 可以重开 (closed -> reopened)", () => {
    expect(canRoleTransition("tester", "closed", "reopened")).toBe(true);
    expect(canRoleTransition("dev", "closed", "reopened")).toBe(false);
  });

  it("同状态不允许", () => {
    expect(canTransition("open", "open")).toBe(false);
  });

  it("非法跳转被拒", () => {
    expect(canTransition("open", "fixed")).toBe(false);
    expect(canRoleTransition("admin", "open", "fixed")).toBe(false);
  });

  it("列出所有允许的下一状态", () => {
    expect(allowedTransitions("open")).toContain("assigned");
    expect(allowedTransitions("closed")).toEqual(["reopened"]);
  });
});

describe("describeTransition 描述", () => {
  it("未知跳转给个通用描述", () => {
    expect(describeTransition("open", "open")).toBe("open -> open");
  });
  it("建单描述", () => {
    expect(describeTransition(null, "open")).toBe("创建");
  });
});
