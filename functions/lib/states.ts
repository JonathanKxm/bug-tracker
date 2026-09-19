// functions/lib/states.ts - Bug 状态机定义 + 颜色映射

import type { BugStatus, Severity } from "../types";

export const ALL_STATUSES: BugStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "fixed",
  "verifying",
  "closed",
  "reopened",
];

export const ALL_SEVERITIES: Severity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const STATUS_LABEL: Record<BugStatus, string> = {
  open: "待处理",
  assigned: "已分配",
  in_progress: "修复中",
  fixed: "已修复",
  verifying: "验证中",
  closed: "已关闭",
  reopened: "已重开",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "严重",
};

// MUI 主题色
export const STATUS_COLOR: Record<BugStatus, string> = {
  open: "#9e9e9e",
  assigned: "#0288d1",
  in_progress: "#1976d2",
  fixed: "#7b1fa2",
  verifying: "#f57c00",
  closed: "#388e3c",
  reopened: "#d32f2f",
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  low: "#43a047",
  medium: "#fb8c00",
  high: "#e53935",
  critical: "#b71c1c",
};
