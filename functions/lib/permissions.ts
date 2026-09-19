// functions/lib/permissions.ts
// 状态变更角色矩阵 - 唯一权威源

import type { BugStatus, Role } from "../types";

/**
 * 状态机:
 *
 *   open ──assign──▶ assigned ──start──▶ in_progress ──fix──▶ fixed
 *                                                              │
 *                                                              ▼
 *  reopened ──assign──▶ assigned                                verifying
 *     ▲                       │                                  │
 *     └──────reopen───────────┘                                  ▼
 *                                                            closed
 *                                                                  │
 *                                                                  ▼
 *                                                              (terminal)
 */

const TRANSITIONS: Record<BugStatus, BugStatus[]> = {
  open: ["assigned", "closed"], // assign 自动加关闭超短路径
  assigned: ["in_progress", "open", "closed"],
  in_progress: ["fixed", "assigned", "open"],
  fixed: ["verifying", "in_progress", "closed"], // 直接关闭跳过验证
  verifying: ["closed", "fixed", "in_progress"], // 验证不通过回 fixed/in_progress
  closed: ["reopened"],
  reopened: ["assigned", "in_progress", "closed"],
};

export function canTransition(from: BugStatus, to: BugStatus): boolean {
  if (from === to) return false;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function allowedTransitions(from: BugStatus): BugStatus[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * 每个状态变更允许的角色矩阵。
 * key = "from|to"
 *
 * 业务规则:
 *  - assign (open/assigned/reopened -> assigned 或 in_progress): 仅 admin 或当前项目 assignee 操作
 *  - fix (in_progress -> fixed): dev/admin
 *  - verify (fixed -> verifying): 任意项目成员 + tester
 *  - close (verifying|fixed -> closed): reporter 或 admin (只有提单人或管理员能拍板)
 *  - reopen (closed -> reopened): reporter 或 admin
 *  - reopen -> assigned: admin 或原 assignee
 */
type RoleSet = Role[];

const MATRIX: Record<string, RoleSet> = {
  // 0) 创建 -> open: 任意角色都能新建
  "|open": ["admin", "tester", "dev"],

  // 1) 分配 / 接管
  "open|assigned": ["admin"],
  "open|closed": ["admin"],
  "assigned|in_progress": ["admin", "dev"],
  "assigned|open": ["admin"],
  "assigned|closed": ["admin"],
  "in_progress|assigned": ["admin", "dev"],
  "in_progress|fixed": ["admin", "dev"],
  "in_progress|open": ["admin"],

  // 2) 修复完成
  "fixed|verifying": ["admin", "tester", "dev"],
  "fixed|in_progress": ["admin", "dev"], // 验证不通过
  "fixed|closed": ["admin", "tester"],   // 直接验收

  // 3) 验证通过
  "verifying|closed": ["admin", "tester"], // 只有提单人/管理员能最终关闭
  "verifying|fixed": ["admin", "tester", "dev"],
  "verifying|in_progress": ["admin", "dev"],

  // 4) 重开
  "closed|reopened": ["admin", "tester"],
  "reopened|assigned": ["admin"],
  "reopened|in_progress": ["admin", "dev"],
  "reopened|closed": ["admin"],
};

export function canRoleTransition(
  role: Role,
  from: BugStatus,
  to: BugStatus,
): boolean {
  const key = `${from}|${to}`;
  const allowed = MATRIX[key];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function describeTransition(
  from: BugStatus | null,
  to: BugStatus,
): string {
  if (from === null) return "创建";
  const map: Record<string, string> = {
    "open|assigned": "分配",
    "open|closed": "直接关闭",
    "assigned|in_progress": "开始处理",
    "assigned|open": "取消分配",
    "assigned|closed": "关闭",
    "in_progress|assigned": "重新分配",
    "in_progress|fixed": "修复完成",
    "in_progress|open": "退回",
    "fixed|verifying": "提交验证",
    "fixed|in_progress": "验证不通过",
    "fixed|closed": "直接关闭",
    "verifying|closed": "验证通过",
    "verifying|fixed": "退回修复",
    "verifying|in_progress": "退回修复",
    "closed|reopened": "重新打开",
    "reopened|assigned": "重新分配",
    "reopened|in_progress": "直接处理",
    "reopened|closed": "关闭",
  };
  return map[`${from}|${to}`] ?? `${from} -> ${to}`;
}
