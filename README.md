# campus-hub-next

全新实现的校园服务平台（学生生活子平台）。旧仓库 `campus-hub-ruoyi` 仅作为业务参考，不再改动。

- Portal（面向学生）：`/notices`、`/resources`、`/facilities`、`/surveys`、`/votes`、`/library`、`/lostfound`、`/materials`
- Console（面向管理）：`/console/**`（RBAC + 数据范围控制）
- 文档中心：`docs/README.md`

## 功能概览

- 基础设施（Console）：
  - 身份与鉴权（Supabase Auth + Profile 状态机）
  - 组织与岗位（部门树、多部门/多岗位）
  - RBAC（角色/权限码，支持 `*` 通配）
  - 数据范围（按模块配置数据可见范围）
  - 审计日志（管理端写操作可追溯）
  - 平台配置（注册审核开关等）
- 业务模块（Portal/Console）：
  - 通知公告
  - 课程资源分享（上传/审核/榜单/积分）
  - 功能房预约
  - 问卷
  - 投票（冻结版）
  - 材料收集（Collect Engine）
  - 数字图书馆
  - 失物招领

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui + Radix
- Supabase：Auth / Storage / Postgres
- Drizzle ORM（服务端直连 Postgres；表结构在 `packages/db/src/schema`）

## 目录结构

- `app/`：页面与 Route Handlers（BFF API 位于 `app/api/**/route.ts`）
  - `app/(portal)/**`：前台页面（学生）
  - `app/(console)/console/**`：后台页面（管理端，路由前缀 `/console`）
- `lib/`：业务模块 Service/Repository、鉴权、StorageAdapter、配置等
- `packages/db/`：schema 与迁移脚本（SQL Editor 执行）
- `docs/`：需求/API/报告/运维文档
- `scripts/`：演示数据脚本等

## 本地启动（推荐路径）

> 以下命令默认在本项目根目录（`campus-hub-next/`，包含 `package.json`）执行。

### 0) 前置条件

- Node.js + pnpm
- 一个 Supabase 项目（Auth 开启 Email Provider，且要求邮箱验证；Redirect URLs 含 `http://localhost:3000`）

### 1) 安装依赖

```bash
pnpm install
```

### 2) 配置环境变量

复制 `.env.example` → `.env.local`，并按你的 Supabase 项目填入：

- 必需：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`（仅服务端/脚本使用，不要暴露到客户端）
  - `DATABASE_URL`（建议使用 Supabase Transaction Pooler 连接串）
- 可选（仅当需要 AI 能力时配置）：
  - `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL`

> 环境变量会在服务端启动时做 zod 校验（见 `lib/config.ts`），缺失会直接报错。

### 3) 初始化数据库（Supabase SQL Editor）

在 Supabase Dashboard 打开 **SQL Editor**，按编号从小到大执行 `packages/db/migrations/*.sql`。

- 迁移清单与说明：`packages/db/README.md`
- 最低要求（含完整演示数据/全模块表）：执行到 `migrations/0011_votes.sql`

### 4) 初始化 Storage（Supabase Storage）

创建以下 bucket（建议除头像外均为 private；下载走服务端签名 URL）：

- `avatars`（public）
- `notice-attachments`（private）
- `course-resources`（private）
- `library-books`（private）
- `lostfound`（private）
- `material-templates`（private）
- `material-submissions`（private）

运维初始化与验收清单：`docs/ops/infra-bootstrap.md`

### 5) 启动

```bash
pnpm dev
```

打开 `http://localhost:3000`

如遇 Turbopack 兼容性问题，可切到 Webpack：

```bash
pnpm dev:webpack
```

## 权限与角色（RBAC）

- 默认注册用户会触发器写入：
  - `profiles`（主键 = `auth.users.id`）
  - `user_roles`（默认角色 `user`）
- Console 访问由权限码控制（示例：`campus:notice:*`），角色与权限的维护入口：`/console/roles`

示例：手工给某用户追加 `staff` 角色（用于进入管理端公告等模块）：

```sql
insert into public.user_roles (user_id, role_id)
select '<auth_user_id>', r.id
from public.roles r
where r.code = 'staff'
on conflict do nothing;
```

## 一键生成演示数据（推荐）

前提：
- 已配置好 `.env.local`
- 已执行迁移：`packages/db/migrations/0001_baseline.sql ~ 0011_votes.sql`

生成/补齐演示数据（幂等；包含公告、课程资源、功能房、问卷、投票、图书馆、失物招领、材料收集 + 4 个演示账号）：

```bash
pnpm demo:seed
```

默认演示账号（可通过环境变量覆盖，见 `scripts/demo-data.mjs`）：

- `super_admin@campus-hub.test`
- `staff@campus-hub.test`
- `user1@campus-hub.test`
- `user2@campus-hub.test`

默认密码：`CampusHub123!`（可用 `DEMO_PASSWORD` 覆盖）

清理演示数据（不删除演示账号；需要显式确认）：

```bash
DEMO_RESET_CONFIRM=YES pnpm demo:reset
```

## 常用命令

```bash
pnpm dev            # 本地开发（Turbopack）
pnpm dev:webpack    # 本地开发（Webpack）
pnpm build          # 构建（Webpack）
pnpm start          # 生产启动（本地）
pnpm lint           # ESLint
pnpm test           # Vitest（run）
pnpm test:watch     # Vitest（watch）
pnpm demo:seed      # 生成/补齐演示数据
pnpm demo:reset     # 清理演示数据（需 DEMO_RESET_CONFIRM=YES）
```

## 部署（Vercel + Supabase）

- Vercel 项目 Root Directory 选择 `campus-hub-next`
- 环境变量按 `.env.example` 配置（生产建议使用 Supabase Transaction Pooler 作为 `DATABASE_URL`）
- 数据库迁移：在 Supabase SQL Editor 按顺序执行 `packages/db/migrations/*.sql`
