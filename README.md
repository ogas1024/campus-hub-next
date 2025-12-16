# campus-hub-next

全新实现的校园服务平台（学习项目），旧仓库 `campus-hub-ruoyi` 仅作为业务参考。

## 当前进度

- ✅ 通知公告（MVP）：后端 API + Portal/Console 基础页面
- 🟠 其他模块：按优先级逐步推进（课程资源分享 → 功能房预约 → 问卷 → 投票 → 数字图书馆 → 失物招领）

文档入口：`docs/README.md`

## 本地启动（最小步骤）

1) 安装依赖

```bash
pnpm install
```

2) 配置环境变量

- 复制 `.env.example` → `.env.local`
- 按 Supabase 项目填入：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_URL`

3) 初始化数据库（Supabase SQL Editor）

执行：`packages/db/migrations/0001_baseline.sql`

4) 初始化 Storage

在 Supabase Storage 创建 **私有** bucket：`notice-attachments`

5) 启动

```bash
pnpm dev
```

打开 `http://localhost:3000`

## 权限与测试账号（通知公告）

默认注册用户会被触发器写入：

- `profiles`（主键 = `auth.users.id`）
- `user_roles`（默认角色 `user`）

要进入后台 `/console/notices`，需要给用户分配 `staff`（或 `admin/super_admin`）角色。示例 SQL：

```sql
insert into public.user_roles (user_id, role_id)
select '<auth_user_id>', r.id
from public.roles r
where r.code = 'staff'
on conflict do nothing;
```
