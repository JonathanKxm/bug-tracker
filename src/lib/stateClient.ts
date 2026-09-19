// 前端权限矩阵 - 镜像后端
import type { BugStatus, Role } from "@/types";

const T: Record<string, Role[]> = {
  "|open": ["admin", "tester", "dev"],
  "open|assigned": ["admin"],
  "open|closed": ["admin"],
  "assigned|in_progress": ["admin", "dev"],
  "assigned|open": ["admin"],
  "assigned|closed": ["admin"],
  "in_progress|assigned": ["admin", "dev"],
  "in_progress|fixed": ["admin", "dev"],
  "in_progress|open": ["admin"],
  "fixed|verifying": ["admin", "tester", "dev"],
  "fixed|in_progress": ["admin", "dev"],
  "fixed|closed": ["admin", "tester"],
  "verifying|closed": ["admin", "tester"],
  "verifying|fixed": ["admin", "tester", "dev"],
  "verifying|in_progress": ["admin", "dev"],
  "closed|reopened": ["admin", "tester"],
  "reopened|assigned": ["admin"],
  "reopened|in_progress": ["admin", "dev"],
  "reopened|closed": ["admin"],
};

export function canTransition(from: BugStatus, to: BugStatus): boolean {
  const allowed = T[`${from}|${to}`];
  return !!allowed;
}

export function canUserTransition(role: Role | undefined, from: BugStatus, to: BugStatus): boolean {
  if (!role) return false;
  const allowed = T[`${from}|${to}`];
  return !!allowed && allowed.includes(role);
}
