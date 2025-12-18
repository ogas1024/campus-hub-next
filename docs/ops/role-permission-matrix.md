# 运维｜默认角色-权限矩阵（模板）

**状态**：建议采用（可按学校组织与业务裁剪）  
**版本**：v1.0  
**最近更新**：2025-12-18

> 目标：给出“默认角色集合 + 推荐权限码集合 + 授权口径”，便于从 0 落地一套可维护、可扩展的 RBAC。  
> 原则：**模块可见性/接口访问**用权限码（RBAC）控制；**数据范围**用 RoleDataScope 控制（见 `docs/requirements/data-permission.md`）。

## 1. 命名与通配符（冻结口径）

### 1.1 权限码格式
- 权限码统一：`campus:<module>:<op>`
- `module` 必须与模块/资源命名一致：
  - `module=user` ↔ `/console/users` ↔ `/api/console/users`
  - `module=notice` ↔ `/console/notices` ↔ `/api/console/notices`
  - 详见：`docs/requirements/data-permission.md`

### 1.2 通配符
系统支持 `*` 通配符，且支持任意段位通配：
- `campus:notice:*`：匹配 `campus:notice:list/create/update/...`
- `campus:*:*`：匹配所有权限（**强烈建议仅 `super_admin` 可用**）

> 说明：权限字典（`public.permissions`）里也可以保存带 `*` 的权限码（例如 `campus:role:*`），用于“全量管理”的授权表达。

## 2. 当前已内置的权限字典（MVP）

> 以下权限来自迁移种子数据：`packages/db/migrations/0001_baseline.sql`、`packages/db/migrations/0002_infra.sql`

### 2.1 通知公告（module=notice）
- `campus:notice:list`
- `campus:notice:create`
- `campus:notice:update`
- `campus:notice:delete`
- `campus:notice:publish`
- `campus:notice:pin`
- `campus:notice:manage`（全量管理；也可在后续用 `campus:notice:*` 替代）

### 2.2 基础设施（module=user/role/permission/department/position/audit/config）
- 用户（module=user）
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
- 角色（module=role）：`campus:role:*`
- 权限字典（module=permission）：`campus:permission:*`
- 部门（module=department）：`campus:department:*`
- 岗位（module=position）：`campus:position:*`
- 审计（module=audit）：`campus:audit:list`
- 配置（module=config）：`campus:config:update`

## 3. 默认角色集合（建议保留）

> 建议保留内置：`user/staff/admin/super_admin`，并按业务追加角色（如 `librarian/major_lead/...`）。

### 3.1 `user`（普通用户）
- 定位：Portal（前台）使用者
- 权限建议：**默认不授予任何 Console 权限码**

### 3.2 `staff`（工作人员）
- 定位：面向公告等内容运营/发布人员
- 权限建议（MVP）：
  - `campus:notice:list/create/update/delete/publish/pin`
- 备注：
  - “是否允许操作他人公告”建议走应用层的资源级授权策略（例如仅允许管理自己创建的公告），避免把业务策略写死在权限码层。

### 3.3 `admin`（管理员）
- 定位：系统管理员（管理端全量配置与大部分模块管理）
- 权限建议（MVP）：
  - 基础设施全量：`campus:user:*`、`campus:role:*`、`campus:permission:*`、`campus:department:*`、`campus:position:*`、`campus:audit:list`、`campus:config:update`
  - 通知公告全量：`campus:notice:manage`（或 `campus:notice:*`）

### 3.4 `super_admin`（超级管理员）
- 定位：最高权限（仅少量账号）
- 权限建议（MVP）：
  - 与 `admin` 一致（当前已内置）
- 推荐增强（非 MVP，可后续引入）：
  - 额外新增一条权限码：`campus:*:*`，用于“平台级全量权限”表达（注意：仅 super_admin 授权）

## 4. 示例矩阵（可直接复制到内部 Wiki/文档）

| 角色 | 建议权限码 | 说明 |
| --- | --- | --- |
| `user` | （空） | 仅 Portal；Console 入口由权限控制 |
| `staff` | `campus:notice:list/create/update/delete/publish/pin` | 内容发布人员（资源级授权在应用层） |
| `admin` | `campus:user:*`、`campus:role:*`、`campus:permission:*`、`campus:department:*`、`campus:position:*`、`campus:audit:list`、`campus:config:update`、`campus:notice:*` | 业务管理者/系统管理员 |
| `super_admin` | 与 `admin` 相同（可选增加 `campus:*:*`） | 超管最小集（避免日常滥用） |

## 5. 数据范围（RoleDataScope）建议

> 数据范围不是“能不能访问”的问题，而是“能看见多少数据”。必须与权限码配合使用。

建议从 `module=user` 开始验收（见 `docs/ops/data-scope-verification.md`），然后按模块逐步接入：
- 若某角色需要访问 `/console/users`：必须同时具备
  - RBAC：`campus:user:list`
  - DataScope：`module=user` 的范围配置（或默认策略）

