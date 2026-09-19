-- ============================================================================
-- Bug Tracker · 0001_init.sql
-- 表: users / projects / project_members / bugs / bug_history / comments
--      attachments / tags / bug_tags / notifications / bug_subscriptions / audit_log
-- ============================================================================

PRAGMA foreign_keys = ON;

-- users: Access 登录时自动同步;首位登录升级为 admin
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'tester',         -- admin / tester / dev
  email_notify_enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

-- projects: 每个 Bug 必属于一个项目;只有管理员能创建
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL,                   -- 短代码,如 "WEB" "API",Bug 编号前缀
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0          -- 1 = 归档(只读)
);

-- project_members: 多对多;不在表里的用户看不到该项目
CREATE TABLE project_members (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_role TEXT NOT NULL DEFAULT 'developer',  -- developer / verifier / viewer
  added_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

-- bugs: 核心实体,必属于某个项目
CREATE TABLE bugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  bug_number INTEGER NOT NULL,                -- 项目内自增,如 1 -> WEB-001
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,                     -- low / medium / high / critical
  status TEXT NOT NULL DEFAULT 'open',        -- open / assigned / in_progress / fixed / verifying / closed / reopened
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  assignee_id INTEGER REFERENCES users(id),
  due_at INTEGER,                             -- 截止时间(可选)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER,
  deleted_at INTEGER,                         -- 软删除;NULL = 未删除
  UNIQUE(project_id, bug_number)
);

-- bug_history: 状态流转审计,供 Sankey 图统计
CREATE TABLE bug_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bug_id INTEGER NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  note TEXT,
  changed_at INTEGER NOT NULL
);

-- comments: 提 Bug、改 Bug 过程中的讨论与回归说明
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bug_id INTEGER NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- attachments: R2 对象 key 索引
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bug_id INTEGER NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT,
  size INTEGER NOT NULL,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  uploaded_at INTEGER NOT NULL
);

-- tags: 每个项目独立命名空间
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,                                 -- MUI Chip 颜色,如 '#1976d2'
  created_at INTEGER NOT NULL,
  UNIQUE(project_id, name)
);

CREATE TABLE bug_tags (
  bug_id INTEGER NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bug_id, tag_id)
);

-- notifications: 站内通知
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                         -- bug_assigned / bug_status_changed / bug_commented / bug_reopened
  bug_id INTEGER REFERENCES bugs(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT,
  read_at INTEGER,
  email_sent_at INTEGER,                      -- NULL = 未发邮件
  created_at INTEGER NOT NULL
);

-- bug_subscriptions: 用户订阅某个 bug 的所有变更
CREATE TABLE bug_subscriptions (
  bug_id INTEGER NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscribed_at INTEGER NOT NULL,
  PRIMARY KEY (bug_id, user_id)
);

-- audit_log: 管理员操作/删除/角色调整/项目归档
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,                       -- user.role_changed / project.archived / project.member_added ...
  target_type TEXT NOT NULL,                  -- user / project / bug
  target_id INTEGER NOT NULL,
  details TEXT,                               -- JSON 字符串,记录前后值
  created_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX idx_bugs_project ON bugs(project_id);
CREATE INDEX idx_bugs_status ON bugs(status);
CREATE INDEX idx_bugs_assignee ON bugs(assignee_id);
CREATE INDEX idx_bugs_deleted ON bugs(deleted_at);
CREATE INDEX idx_pm_user ON project_members(user_id);
CREATE INDEX idx_history_bug ON bug_history(bug_id);
CREATE INDEX idx_notif_user ON notifications(user_id, read_at);
CREATE INDEX idx_audit_target ON audit_log(target_type, target_id);
CREATE INDEX idx_comments_bug ON comments(bug_id);
CREATE INDEX idx_attachments_bug ON attachments(bug_id);
CREATE INDEX idx_subscriptions_user ON bug_subscriptions(user_id);
