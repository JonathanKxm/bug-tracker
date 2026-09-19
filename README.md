# Bug Tracker · Cloudflare 全栈方案

> 基于 Cloudflare Pages + Functions + D1 + R2,Sankey 图状态流转可视化 + 三角色 RBAC + 移动端响应式 + 客户端图片压缩的轻量 Bug 跟踪系统。

## 一、架构一览

```
用户浏览器 (MUI v5 SPA)
   │
   ├── Cloudflare Access ── JWT 验证 ──┐
   │                                  ▼
   └── Pages Functions (Node-style handlers) ── 共享 _middleware.ts
         │  ├─ /api/projects/*   │
         │  ├─ /api/bugs/*       │  D1 (SQLite)
         │  ├─ /api/tags/*       └─────┐
         │  ├─ /api/notifications/*    │
         │  ├─ /api/audit/*        ◀───┘
         │  └─ /api/attachments/*  ── R2 (对象存储)
         │
         └── Pages static assets (Vite 构建产物)
```

## 二、二次开发指引

### 2.1 一类核心缺口已全实现 (MVP)

| # | 模块 | 关键文件 | 备注 |
|---|---|---|---|
| 1 | **Bug 编号自动生成** | `functions/api/bugs/index.ts` (POST handler) | 项目内 `MAX(bug_number)+1` + `UNIQUE(project_id,bug_number)` 兜底并发重试 |
| 2 | **标签 / 模块** | `functions/api/tags/*` + 表 `tags`/`bug_tags` | MUI `Autocomplete multiple freeSolo`;项目命名空间 |
| 3 | **全文搜索** | `functions/api/bugs/index.ts` GET | `LOWER(title) LIKE ? OR LOWER(description) LIKE ?`;前端 300ms 防抖 |
| 4 | **分页 + 排序** | `/api/bugs?page=&pageSize=&sort=-updated_at` | severity 自定义 CASE 排序;返回 `{items,total,page,pageSize,hasMore}` |
| 5 | **通知** | `functions/lib/notify.ts` + `notifications` 表 | 站内 + Cloudflare Email Service;`NotificationCenter` Drawer + Badge |
| 6 | **审计日志** | `functions/lib/audit.ts` + `audit_log` 表 | `record(actor, action, targetType, targetId, details)` |
| 7 | **软删除** | `bugs.deleted_at` + 仅 admin `POST /api/bugs/:id/restore` | 所有读过滤 `deleted_at IS NULL`;admin 可在表上勾选"显示已删除" |

### 2.2 状态机 + 角色矩阵

完整规则见 [`functions/lib/permissions.ts`](functions/lib/permissions.ts)。  
前端镜像见 [`src/lib/stateClient.ts`](src/lib/stateClient.ts) — **必须保持同步**。

| 转换 | admin | tester | dev |
|---|---|---|---|
| `open → assigned` | ✅ | ❌ | ❌ |
| `assigned → in_progress` | ✅ | ❌ | ✅ |
| `in_progress → fixed` | ✅ | ❌ | ✅ |
| `fixed → verifying` | ✅ | ✅ | ✅ |
| `verifying → closed` | ✅ | ✅ | ❌ |
| `closed → reopened` | ✅ | ✅ | ❌ |

### 2.3 上传与图片压缩

- 客户端: `src/components/ImageUploader.tsx` 用 `browser-image-compression` 自动压缩到 ≤ 4MB,最长边 1920px。
- 服务端: `functions/lib/upload.ts` 5MB 硬限 + 类型白名单 + `Content-Length` 预检。

## 三、本地开发

```bash
# 1. 安装依赖
npm install

# 2. 创建 D1 / R2 (一次)
# npx wrangler d1 create bug-tracker
# 把输出的 database_id 填到 wrangler.jsonc
# npx wrangler r2 bucket create bug-tracker-attachments

# 3. 本地 migration (生产前)
npm run db:migrate:local
npm run db:seed:local

# 4. 起前端
npm run dev              # 5173 - vite (Mock API not used here)
npm run pages:dev        # 8788 - wrangler pages dev (完整模拟 Pages)

# 5. 跑测试
npm test                 # vitest 单测
npm run e2e              # playwright E2E (默认启 webServer)
```

### 本地跳过 Access

设置 `.dev.vars`:
```
DEV_FAKE_USER=admin@example.com
```
中间件会自动用此邮箱"模拟登录"。

## 四、部署

```bash
# 1. 建 D1 + 迁移
npm run db:migrate:remote

# 2. 部署前设好
#   ACCESS_AUD / ACCESS_TEAM_DOMAIN / send_email binding
#   关掉 DEV_FAKE_USER (生产环境不允许伪造)

# 3. 构建 + 部署
npm run build
npm run pages:deploy
```

## 五、API 速查

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/me` | 当前用户 + 项目 |
| GET/POST | `/api/projects` | 列表 / 新建 |
| GET/PATCH | `/api/projects/:id` | 详情 / 归档/改名 |
| POST/DELETE | `/api/projects/:id/members` | 加成员 / 踢人 |
| GET | `/api/projects/:id/sankey` | 项目级 Sankey 数据 |
| GET/POST | `/api/bugs?project=&q=&status=&tag=&page=` | 列表(搜索/分页/排序) / 创建 |
| GET/PATCH/DELETE | `/api/bugs/:id` | 详情 / 更新 / 软删除 |
| POST | `/api/bugs/:id/restore` | admin 恢复 |
| GET/POST | `/api/bugs/:id/comments` | 评论列表 / 添加 |
| PUT | `/api/bugs/:id/tags` | 替换标签 |
| POST/DELETE | `/api/bugs/:id/subscribe` | 订阅 |
| GET/POST/DELETE | `/api/tags` | 标签 |
| GET | `/api/bugs/:id/attachments` | 附件列表 |
| POST | `/api/bugs/:id/attachments` | 上传(5MB) |
| GET | `/api/attachments/:id/image` | 图片(公 cacheable) |
| GET | `/api/attachments/:id` | 下载 |
| GET/POST | `/api/notifications` | 通知列表 / 批量已读 |
| GET | `/api/audit?target_type=&target_id=` | 审计日志 (admin only) |
| GET/PATCH | `/api/users/:id` | 改角色 / 改自己偏好 |

## 六、测试矩阵

```bash
# 单测 (vitest)
npm test
#   permissions.test.ts   - 17 条合法/非法转换覆盖
#   upload.test.ts        - 5MB 边界 + 全部类型
#   stateClient.test.ts   - 前端矩阵一致性

# E2E (playwright)
npm run e2e
#   smoke.spec.ts         - dev fake 登录 + 项目页
#   api.spec.ts           - 直测 API 健康度
#   permissions.spec.ts   - role boundary (dev 不能 close)
#   mobile.spec.ts        - 375×667 + 768×1024
```
