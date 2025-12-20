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
- `migrations/0004_course_resources.sql`
- `migrations/0005_course_resources_constraints.sql`
- `migrations/0006_facility_reservations.sql`
- `migrations/0007_surveys.sql`

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

### 0004_course_resources.sql 变更概览
- 新增课程资源分享相关枚举：
  - `public.course_resource_type`（`file|link`）
  - `public.course_resource_status`（`draft|pending|published|rejected|unpublished`）
  - `public.course_resource_score_event_type`（`approve|best`）
- 新增业务表：
  - `public.majors`（专业）/ `public.major_leads`（专业负责人映射）
  - `public.courses`（课程）
  - `public.course_resources`（课程资源，含状态机/软删/去重索引）
  - `public.course_resource_bests`（最佳推荐）
  - `public.course_resource_download_events`（下载事件事实表）
  - `public.course_resource_score_events`（积分事件事实表，唯一约束保证“首次语义”）
- 种子数据：
  - `public.app_config`：`courseResources.score.approveDelta` / `courseResources.score.bestDelta`
  - `public.roles`：新增 `major_lead`
  - `public.permissions`：新增 `campus:resource:*` 及细分权限；为 `major_lead/admin/super_admin` 授权
- RLS：对新增表 `enable row level security`（默认不下发策略；避免客户端直连）

### 0005_course_resources_constraints.sql 变更概览
- 调整 `public.course_resources` 的 `course_resources_file_or_link_chk`：
  - 允许 `draft` 阶段暂不绑定 file/link 细节（支撑“先草稿 → 签名直传/填写外链 → 提交审核”流程）

### 0006_facility_reservations.sql 变更概览
- 新增功能房预约相关枚举与业务表：
  - `public.facility_buildings` / `public.facility_rooms`
  - `public.facility_reservations` / `public.facility_reservation_participants`
  - `public.facility_bans` / `public.app_config` 默认值
- 种子数据：
  - `public.permissions`：新增 `campus:facility:*` 等权限码并为 `staff/admin/super_admin` 授权
- RLS：对新增表 `enable row level security`（默认不下发策略；避免客户端直连）

### 0007_surveys.sql 变更概览
- 新增问卷相关枚举与业务表：
  - `public.surveys` / `public.survey_scopes`
  - `public.survey_sections` / `public.survey_questions` / `public.survey_question_options`
  - `public.survey_responses` / `public.survey_response_items`
- 种子数据：
  - `public.permissions`：新增 `campus:survey:*` 等权限码并为 `staff/admin/super_admin` 授权
- RLS：对新增表 `enable row level security`（默认不下发策略；避免客户端直连）

## 本地/远端初始化（推荐流程）

1. 在 Supabase Dashboard 打开 **SQL Editor**
2. 依次执行 `migrations/` 下的 SQL（从小到大）

> 后续接入 drizzle-kit 后，会在本目录增加自动生成的迁移目录（如 `drizzle/`），届时再统一收敛执行顺序。
