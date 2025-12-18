# 基础设施｜审计日志（Audit）需求说明

**状态**：✅ 已批准  
**版本**：v1.0（MVP 冻结版）  
**最近更新**：2025-12-17

> 目标：为平台后台管理端提供可追溯、可审计、可检索的变更记录，满足问题排查与合规要求。  
> 原则：**只写入不修改**（append-only），尽量避免不可控的敏感信息扩散。

## 1. 范围（Scope）

### 1.1 MVP（必须实现）
- 覆盖 Console 关键管理动作的审计记录：
  - 原则上所有在Console中的操作都应该有审计记录
  - 用户：创建、邀请、审核、停用/启用、封禁/解封、删除、重置密码（如支持）
  - 角色/权限：角色 CRUD、角色权限变更、权限字典变更（如允许）
  - 组织/岗位：部门树变更（新增/移动/改名/排序/删除失败原因）、岗位启停/删除、用户-部门/岗位分配变更
  - 数据权限：角色数据范围变更（RoleDataScope）
  - 通知公告：创建、编辑、发布/撤回、置顶/取消置顶、删除、附件上传
- 审计记录必须包含：操作者、动作、对象、差异、原因（可选但推荐）、时间、请求上下文（IP/UA/requestId）。

### 1.2 非目标（Out of Scope）
- 全量埋点（如页面访问、点击流）不属于审计范围。
- 审计日志导出/归档/对接外部 SIEM 可作为 Phase 2。

## 2. 审计事件模型（概览）

### 2.1 表结构建议：audit_logs
字段建议（实现阶段落表）：
- `id` uuid
- `occurred_at` timestamptz（事件时间）
- `actor_user_id` uuid（操作者 userId）
- `actor_email` text（可选，便于检索；注意软删除后可能变化）
- `actor_roles` jsonb（可选：当时角色快照）
- `action` text（例如 `user.create`, `user.ban`, `role.permissions.update`）
- `target_type` text（例如 `user`, `role`, `department`, `position`）
- `target_id` text（uuid 或复合键的字符串化）
- `success` boolean
- `error_code` text（失败时）
- `reason` text（操作者输入）
- `diff` jsonb（前后值/差异；建议记录“变更字段集合”，避免全量快照）
- `request_id` text（链路追踪）
- `ip` inet / text
- `user_agent` text

### 2.2 不可变约束
- 审计表必须为 append-only：
  - 禁止 update/delete（可通过 DB 约束或 RLS 策略实现）
  - 如需纠错，只允许写入“补充事件”（例如 `audit.corrective_note`）

### 2.3 数据最小化与敏感信息
- 不记录明文密码、密钥、邀请链接等敏感信息。
- `diff` 中的字段应做白名单过滤（例如可记录 `status`、`roleIds`、`departmentIds` 等）。

## 3. 关键业务规则与约束
- 所有 Console 管理动作必须在“业务成功/失败”后都写审计：
  - 成功：记录 diff
  - 失败：记录 error_code/错误摘要（不泄露敏感信息）
- 批量操作（导入/批量分配）：
  - 需要可关联同一 `request_id` 或 `batch_id`（实现阶段决定）

## 4. 查询需求（MVP）
- Console 提供审计列表：
  - 按时间范围、操作者、action、targetType、success 过滤
  - 分页
  - 详情查看（diff 展示）

## 5. 验收标准（MVP）
- 至少覆盖 2 类关键动作的审计写入与查询展示（例如：用户封禁、角色权限变更）。
- 审计记录不可被修改/删除（技术实现可在实现阶段验证）。
