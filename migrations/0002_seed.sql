-- ============================================================================
-- Bug Tracker · 0002_seed.sql (可选,本地开发用)
-- ============================================================================

-- 示例 admin (id 会在第一次 Access 登录时被复用)
INSERT OR IGNORE INTO users (id, email, name, role, email_notify_enabled, created_at, last_seen_at)
VALUES (1, 'admin@example.com', 'Admin', 'admin', 1, strftime('%s','now')*1000, strftime('%s','now')*1000);

INSERT OR IGNORE INTO projects (id, name, key, description, created_by, created_at)
VALUES
  (1, 'Website', 'WEB', '官方网站前端', 1, strftime('%s','now')*1000),
  (2, 'Backend API', 'API', '后端服务', 1, strftime('%s','now')*1000);

INSERT OR IGNORE INTO project_members (project_id, user_id, project_role, added_at)
VALUES (1, 1, 'developer', strftime('%s','now')*1000);
