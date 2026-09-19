# Bug Tracker · 部署指南

## 1. 前置要求

- Node.js ≥ 20 (推荐 20.17+)
- npm ≥ 10
- Cloudflare 账号 + 已启用 Pages、D1、R2、Access、Email Service

## 2. 一次性准备

```bash
# 1. 安装依赖
npm install

# 2. 创建 D1 数据库
npx wrangler d1 create bug-tracker
# 把输出的 database_id 填入 wrangler.json

# 3. 创建 R2 bucket
npx wrangler r2 bucket create bug-tracker-attachments

# 4. 创建 Cloudflare Access 应用
#    - 类型: Self-hosted
#    - 域名: 你的 Pages 自定义域名
#    - Policy: email 匹配 (@yourcompany.com)
#    - 把生成的 AUD / TEAM_DOMAIN 填入 wrangler.json 的 vars + .dev.vars.example 的注释

# 5. 配置 Email Service (可选)
#    - 在 wrangler.json 里 uncomment send_email binding
#    - 域名在 Cloudflare Email Routing 设置好
```

## 3. 本地开发

```bash
# 创建 .dev.vars
cp .dev.vars.example .dev.vars
# 编辑: DEV_FAKE_USER=你的邮箱

# 跑 D1 迁移
npm run db:migrate:local
npm run db:seed:local

# 起本地 Pages (8788)
npx wrangler pages dev ./dist --port 8788 --persist-to .wrangler/state --compatibility-date=2025-01-01

# 或者 前端 dev (5173, mock API)
npm run dev
```

## 4. 跑测试

```bash
# 单元测试 (vitest) — 不需要 DB
npm test

# E2E (playwright) — 需要 wrangler pages dev 在 8788
npx playwright install chromium   # 一次性
npm run e2e
```

## 5. 部署到生产

```bash
# 1. 应用 D1 迁移
npx wrangler d1 migrations apply bug-tracker --remote

# 2. 构建前端
npm run build

# 3. 部署到 Pages
npx wrangler pages deploy ./dist --project-name bug-tracker

# 4. 在 Cloudflare Dashboard 配置:
#    - Pages 自定义域名
#    - Access 保护 (Path: /*)
#    - send_email binding (可选)
#    - 设置 vars: ACCESS_AUD, ACCESS_TEAM_DOMAIN
#    - 把 DEV_FAKE_USER **不要** 设置 (生产禁止伪造)
```

## 6. 检查清单 (上线前)

- [ ] `wrangler.json` 的 `database_id` 已替换
- [ ] `.dev.vars` 未上传到 git (已在 .gitignore)
- [ ] `DEV_FAKE_USER` 在生产 Cloudflare dashboard vars 里 **未设置**
- [ ] `npm test` 通过 (21/21)
- [ ] `npm run e2e` 通过 (15/15)
- [ ] `npm run build` 通过
- [ ] Access policy 设置正确
- [ ] D1 remote migration 完成
- [ ] R2 bucket 已创建
- [ ] Email Service 配置 (可选)

## 7. 已知限制 (MVP)

- Access 验证: 当前实现基于 `Cf-Access-*` header 信任(由 Cloudflare 边缘注入)
  真正严格生产可配 JWKS 验证签名 (见 `functions/_middleware.ts` 注释)
- D1 LIKE 搜索: 100 条以上项目考虑升级 FTS5 虚拟表
- 邮件需要 Cloudflare Email Service binding (生产需付费或自配)
- 字体大小: 中文 woff2 切分多包,首屏加载 ~1.2s

## 8. 测试覆盖率

```
src/                                # 前端
├── App.tsx                        # 路由
├── theme.ts                       # MUI 主题
├── components/
│   ├── AppShell.tsx               # 顶栏 + 侧栏 (移动抽屉)
│   ├── NotificationCenter.tsx     # 站内通知 drawer
│   └── ImageUploader.tsx          # 客户端压缩 + 上传
├── pages/
│   ├── LoginPage.tsx              # 登录引导
│   ├── ProjectsPage.tsx           # 项目卡片列表
│   ├── ProjectWorkspace.tsx       # bug 列表 + 搜索 + 过滤
│   ├── BugDetailPage.tsx          # 详情 + 流转 + 审计
│   └── AdminPage.tsx              # admin 用户管理
└── lib/
    ├── api.ts                     # fetch 封装
    ├── auth.tsx                   # 当前用户 Context
    ├── stateClient.ts             # 前端权限矩阵
    └── useNotifications.ts        # 通知 hook

functions/                          # 后端 (Pages Functions)
├── _middleware.ts                 # Access 验证 + 自动注册
├── types.ts                       # 共享类型
├── lib/
│   ├── auth.ts                    # (备用)
│   ├── permissions.ts             # 状态机 + 角色矩阵
│   ├── states.ts                  # 状态/严重度常量
│   ├── upload.ts                  # 上传校验 (5MB + 类型)
│   ├── notify.ts                  # 通知触发 (站内 + 邮件)
│   └── audit.ts                   # 审计日志写入
└── api/                            # REST handlers (30+)
    ├── health.ts / me.ts
    ├── projects/  + [id]/ + [id]/members.ts + [id]/sankey.ts
    ├── users/ + [id].ts
    ├── bugs/ + [id]/ + [id]/comments|history|tags|subscribe|attachments|restore
    ├── tags/ + [id]
    ├── notifications/
    └── audit/

migrations/
├── 0001_init.sql                  # 12 张表 + 9 个索引
└── 0002_seed.sql                  # admin + seed 项目 (可选)

tests/
├── unit/                           # vitest (21 cases)
│   ├── permissions.test.ts        # 全部状态跳转 + 角色
│   ├── upload.test.ts             # 5MB 边界 + 类型
│   └── stateClient.test.ts        # 前端矩阵一致性
└── e2e/                            # playwright (15 cases)
    ├── smoke.spec.ts              # dev fake 登录
    ├── api.spec.ts                # 直 API 健康
    ├── permissions.spec.ts        # role boundary
    └── mobile.spec.ts             # 375×667 / 768×1024
```
