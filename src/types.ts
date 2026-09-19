// 共享类型(前端)
export type Role = "admin" | "tester" | "dev";
export type BugStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "fixed"
  | "verifying"
  | "closed"
  | "reopened";
export type Severity = "low" | "medium" | "high" | "critical";

export interface User {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  email_notify_enabled: number;
  created_at: number;
  last_seen_at: number;
}

export interface Project {
  id: number;
  name: string;
  key: string;
  description: string | null;
  created_by: number;
  created_at: number;
  archived: number;
}

export interface Bug {
  id: number;
  project_id: number;
  bug_number: number;
  title: string;
  description: string;
  severity: Severity;
  status: BugStatus;
  reporter_id: number;
  assignee_id: number | null;
  due_at: number | null;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
  deleted_at: number | null;
  reporter_name?: string | null;
  reporter_email?: string;
  assignee_name?: string | null;
  assignee_email?: string | null;
  tags?: { id: number; name: string; color: string | null }[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface Notification {
  id: number;
  user_id: number;
  type: "bug_assigned" | "bug_status_changed" | "bug_commented" | "bug_reopened";
  bug_id: number | null;
  actor_id: number | null;
  title: string;
  body: string | null;
  read_at: number | null;
  created_at: number;
}

export interface Tag {
  id: number;
  project_id: number;
  name: string;
  color: string | null;
  created_at: number;
}

export interface Comment {
  id: number;
  bug_id: number;
  author_id: number;
  content: string;
  created_at: number;
  author_name?: string | null;
  author_email?: string;
}
