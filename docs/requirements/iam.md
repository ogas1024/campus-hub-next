# 基础设施｜身份与访问控制（IAM）需求说明

**状态**：✅ 已批准  
**版本**：v1.0（MVP 冻结版）  
**最近更新**：2025-12-17

> 本文是平台级基础设施（可被未来“招生选拔系统/党建管理系统”等复用）的 IAM 需求说明。  
> 单一事实来源（SSOT）：**Supabase Auth（`auth.users`）为身份与生命周期唯一事实源**；业务侧以 `public.profiles(id=auth.users.id)` 扩展信息。

## 1. 范围（Scope）

### 1.1 目标
- 统一用户身份生命周期（注册/邮箱验证/邀请创建/封禁/删除）与 RBAC（角色/权限码）能力。
- 以权限码控制管理端模块可见性与接口访问，权限码支持通配符。
- 为“数据范围/数据权限”“审计日志”“组织架构”提供可组合的基础能力（见相关文档）。

### 1.2 MVP（必须实现）
- Portal（用户侧）
  - 邮箱/密码注册（强制邮箱验证）
  - 登录/登出
  - 自助修改密码（Supabase Auth 标准能力）
  - 查看/编辑个人基础资料（`profiles`）
- Console（管理侧）
  - 用户列表/详情（聚合 Auth + profiles + 角色/组织/岗位）
  - 用户状态管理：注册审核、停用/启用、封禁/解封、删除（以 Supabase Auth 为准）
  - 用户创建：手动创建、邮箱邀请（Invite）
  - 批量导入（以 Console 执行，结果可追溯与可审计）
  - 角色管理：CRUD
  - 权限分配：角色-权限（RBAC）
- 系统配置
  - 注册审核开关（默认关闭）：控制“邮箱验证通过后是否还需管理员审核”。

### 1.3 非目标（Out of Scope）
- 社交登录、SSO、MFA、企业微信/钉钉等（可作为后续扩展，不影响本设计）。
- 在数据库层依赖复杂 RLS 规则实现数据权限（本项目采用 BFF 强约束；见 `data-permission.md`）。

## 2. 角色与权限

### 2.1 角色（RBAC）
默认内置角色（可扩展）：
- `user`：普通用户
- `staff`：工作人员
- `admin`：管理员
- `super_admin`：超级管理员

> 角色数据结构来自 `public.roles`；角色仅用于授权，不与“组织/岗位”耦合。

### 2.2 权限码
- 命名规范：`campus:<module>:<op>`
- 支持通配符：`*` 表示单段通配，例如：
  - `campus:*:*`：所有权限
  - `campus:notice:*`：公告模块所有操作
  - `campus:user:*`：用户管理所有操作

建议（MVP）权限码集合（可在迁移中声明式写入 `public.permissions`）：
- 用户：
  - `campus:user:list`
  - `campus:user:read`
  - `campus:user:create`
  - `campus:user:update`
  - `campus:user:approve`
  - `campus:user:disable`
  - `campus:user:ban`
  - `campus:user:delete`
  - `campus:user:invite`
  - `campus:user:import`
  - `campus:user:assign_role`
  - `campus:user:assign_org`
- 角色与权限：
  - `campus:role:*`
  - `campus:permission:*`

## 3. 领域模型（概览）

### 3.1 身份与生命周期（Supabase Auth）
- `auth.users`：身份源（邮箱验证、封禁、删除、邀请创建等以此为准）。
- 管理端必须通过 Supabase Admin API 执行用户生命周期动作：
  - `inviteUserByEmail`：发送邀请链接
  - `createUser`：创建用户（可设置 `email_confirm`、`password` 等）
  - `updateUserById`：封禁/解封（`ban_duration`）、重置密码（如允许）
  - `deleteUser(shouldSoftDelete)`：删除用户（MVP 默认 soft delete，见 4.5）

### 3.2 业务侧扩展（profiles）
- `public.profiles`：扩展信息（姓名、学号、用户名、头像、业务态状态等）。
- `profiles` 必须保持极简；业务域扩展通过各自独立表（例如 `profile_library`, `profile_admission` 等），以 `profiles.id` 为外键。

### 3.3 RBAC
- `public.roles`：角色
- `public.permissions`：权限码字典
- `public.user_roles`：用户-角色
- `public.role_permissions`：角色-权限

### 3.4 组织/岗位/数据权限/审计
详见：
- 组织/岗位：`organization.md`
- 数据范围：`data-permission.md`
- 审计日志：`audit.md`

## 4. 关键业务规则与约束

### 4.1 注册与邮箱验证（强制）
- 自助注册必须完成邮箱验证才能进入平台（否则视为不可登录/不可访问）。
- 邮箱验证前：
  - `profiles.status = pending_email_verification`
- 邮箱验证完成后：
  - 若注册审核开关关闭：进入 `active`
  - 若注册审核开关开启：进入 `pending_approval`，需管理员审核通过后进入 `active`

> 说明：最终可访问性以 BFF 的 `getCurrentUser()` 与 `profiles.status` 校验为准；Auth 侧负责邮箱验证真实性。

### 4.2 注册审核开关
- 作为系统配置项（server-side），可在 Console 配置：
  - `registration.requiresApproval: boolean`
  - 默认 `false`
- 开关开启时，管理员需执行“通过/拒绝”：
  - 通过：`pending_approval -> active`
  - 拒绝：`pending_approval -> disabled`

### 4.3 状态机（业务态 + Auth 态）
业务态（`profiles.status`）：
- `pending_email_verification`：等待邮箱验证
- `pending_approval`：等待审核（开关开启时）
- `active`：可正常使用
- `disabled`：停用（业务侧禁止访问）
- `banned`：封禁（必须同步到 Auth 侧 ban）

Auth 侧（`auth.users`）：
- 邮箱是否已验证：`email_confirmed_at`（或等价字段）
- 封禁：`ban_duration`（非 `none` 表示封禁）
- 删除：`deleteUser(shouldSoftDelete)` 为准

一致性要求：
- 对“封禁/解封/删除/创建/邀请”等动作：**先写 Auth，再写业务侧（或在同一事务语义内保证最终一致）**。
- 任何业务侧的“删除用户”不得只删 `profiles/user_roles/...` 而不触达 Auth。

### 4.4 管理端修改他人密码（严格限权）
- 用户自助改密：走 Supabase Auth 标准流程。
- 管理端如提供“重置/设置密码”能力：
  - 仅 `admin/super_admin` 可执行
  - 需要显式权限码（建议 `campus:user:update` + `campus:user:reset_password`）
  - 必须写入审计日志（含原因、目标用户、是否生成临时密码等）

### 4.5 删除用户（MVP 行为）
- MVP 默认行为：调用 `auth.admin.deleteUser(userId, shouldSoftDelete=true)`（不可逆），以避免破坏引用关系并保留审计可追溯性。
- 硬删除（hard delete）仅在满足引用安全（无外键 restrict、无数据归属冲突）时允许，且必须二次确认（Console 交互层）。

### 4.6 权限码匹配（通配符）
匹配规则（MVP）：
- 以 `:` 分段；支持 `*` 单段通配。
- 允许用户拥有多个角色；有效权限为所有角色权限码并集。
- 存在 `campus:*:*` 时可视为全权限。

## 5. 用例列表（MVP）

### 5.1 Portal
- UC-P1：邮箱/密码注册（必须邮箱验证）
- UC-P2：登录/登出
- UC-P3：查看/编辑个人资料（profiles）
- UC-P4：自助修改密码

### 5.2 Console（仅示例，详见各子文档）
- UC-C1：用户列表（按姓名/学号/邮箱/状态/角色过滤）
- UC-C2：用户详情（聚合展示：Auth+profiles+角色+组织+岗位）
- UC-C3：审核用户（requiresApproval 开启时）
- UC-C4：封禁/解封用户（Auth ban）
- UC-C5：停用/启用用户（业务态）
- UC-C6：删除用户（MVP：Auth soft delete）
- UC-C7：创建用户（createUser）
- UC-C8：邀请用户（inviteUserByEmail）
- UC-C9：批量导入用户（createUser/invite，必须可审计与可重放）
- UC-C10：角色 CRUD + 角色权限维护

## 6. 验收标准（MVP）
- 管理端对用户执行“删除/封禁/邀请/创建”等动作后，Supabase Auth 中对应状态可被验证（不允许出现“只删业务表”的漂移）。
- 邮箱未验证用户无法进入平台（登录后也必须被阻断）。
- 注册审核开关可动态启停，并正确影响邮箱验证后的状态流转。
- 权限码支持通配符，`super_admin` 可通过通配符获得全权限（实现细节在实现阶段确定）。
- 所有 Console 的管理动作均写入审计日志（见 `audit.md`）。

## 7. 开放问题（待实现阶段细化）
- “停用（disabled）”是否需要同步 Auth 层（例如强制退出会话/禁止刷新）与具体实现策略。
- 批量导入：是否需要提供“预览/校验/回滚”能力（建议 Phase 2）。
