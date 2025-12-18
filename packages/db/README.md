# 数据库（packages/db）

本目录用于维护 Drizzle schema 与迁移脚本（以 Supabase Postgres 为目标数据库）。

## 目录说明

- `src/schema/**`：Drizzle schema（类型与迁移源）
- `migrations/**`：手工 SQL 迁移（用于包含触发器 / RLS 策略等 Drizzle kit 不擅长表达的部分）

## 迁移执行顺序（Supabase 推荐）

在 Supabase Dashboard 打开 **SQL Editor**，按文件编号从小到大执行：
- `migrations/0001_baseline.sql`
- `migrations/0002_infra.sql`
- `migrations/0003_department_parent_fk.sql`

> 注意：`0002_infra.sql` 依赖 `0001_baseline.sql` 中的 `public.set_updated_at()` 等基础函数与基线表结构。

### 0002_infra.sql 变更概览
- 新增基础设施表：
  - `public.app_config`（平台配置，Key-Value，jsonb）
  - `public.department_closure`（部门闭包表，用于“部门及子部门”范围判断）
  - `public.user_departments`（用户-部门，多对多）
  - `public.role_data_scopes` / `public.role_data_scope_departments`（数据范围/数据权限）
  - `public.audit_logs`（管理端审计日志，append-only）
- 调整：
  - `public.profiles` 默认状态改为 `pending_email_verification`
  - 移除 `public.profiles.department_id`（单部门字段），以 `user_departments` 为唯一事实来源
- 触发器/联动：
  - 部门闭包表维护（insert / parent_id 更新防环）
  - Auth 联动（邮箱验证与注册审核开关影响 `profiles.status`）
- 种子数据：
  - 补齐基础设施权限码与 `admin/super_admin` 授权

### 0003_department_parent_fk.sql 变更概览
- 为 `public.departments.parent_id` 增加自引用外键（`ON DELETE RESTRICT`），从 DB 层禁止删除存在子部门的部门。

## 本地/远端初始化（推荐流程）

1. 在 Supabase Dashboard 打开 **SQL Editor**
2. 依次执行 `migrations/` 下的 SQL（从小到大）

> 后续接入 drizzle-kit 后，会在本目录增加自动生成的迁移目录（如 `drizzle/`），届时再统一收敛执行顺序。
