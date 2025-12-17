# 身份与访问控制（IAM）API 契约（MVP）

**状态**：🟠 待实现  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-17

> 需求来源：`docs/requirements/iam.md`（已冻结 ✅）

## 1. 通用约定

### 1.1 认证
- 默认：需要登录（Supabase Auth Cookie 会话）。
- 管理端接口均要求权限码校验（`requirePerm`/`hasAnyPerm`）。

### 1.2 错误结构
见：`docs/api/README.md`

## 2. 用户（Console）

### 2.1 列表：GET `/api/console/users`

**权限**：`campus:user:list`  
**数据权限**：按 `module=user` 的 RoleDataScope 过滤（见 `docs/requirements/data-permission.md`）

**查询参数**
- `page`：number，默认 1
- `pageSize`：number，默认 20，最大 50
- `q`：string，可选（姓名/邮箱/学号模糊匹配）
- `status`：`pending_email_verification|pending_approval|active|disabled|banned`（可选）
- `roleId`：uuid（可选）
- `departmentId`：uuid（可选，含子部门）
- `positionId`：uuid（可选）
- `sortBy`：`createdAt|updatedAt|lastLoginAt`（默认 `createdAt`）
- `sortOrder`：`asc|desc`（默认 `desc`）

**响应（200）**
```json
{
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "items": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "emailVerified": true,
      "name": "张三",
      "studentId": "2023000000000001",
      "status": "active",
      "roleIds": ["uuid"],
      "departmentIds": ["uuid"],
      "positionIds": ["uuid"],
      "createdAt": "2025-12-17T00:00:00Z",
      "updatedAt": "2025-12-17T00:00:00Z",
      "lastLoginAt": "2025-12-17T00:00:00Z"
    }
  ]
}
```

### 2.2 详情：GET `/api/console/users/:id`

**权限**：`campus:user:read`  
**数据权限**：同 2.1

**响应（200）**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "emailVerified": true,
  "auth": {
    "createdAt": "2025-12-17T00:00:00Z",
    "lastSignInAt": "2025-12-17T00:00:00Z",
    "bannedUntil": null,
    "deletedAt": null
  },
  "profile": {
    "name": "张三",
    "username": "zhangsan",
    "studentId": "2023000000000001",
    "avatarUrl": null,
    "status": "active",
    "createdAt": "2025-12-17T00:00:00Z",
    "updatedAt": "2025-12-17T00:00:00Z",
    "lastLoginAt": "2025-12-17T00:00:00Z"
  },
  "roles": [{ "id": "uuid", "code": "user", "name": "普通用户" }],
  "departments": [{ "id": "uuid", "name": "信息学院", "parentId": null }],
  "positions": [{ "id": "uuid", "name": "图书管理员" }]
}
```

### 2.3 创建（手动创建）：POST `/api/console/users`

**权限**：`campus:user:create`  
**说明**：必须通过 Supabase Admin API 创建（`createUser`）。

**请求体**
```json
{
  "email": "user@example.com",
  "password": "string (可选；不传则走邀请)",
  "emailConfirm": false,
  "name": "张三",
  "studentId": "2023000000000001",
  "roleIds": ["uuid"],
  "departmentIds": ["uuid"],
  "positionIds": ["uuid"]
}
```

**响应（201）**：返回 2.2 的用户详情结构

### 2.4 邀请：POST `/api/console/users/invite`

**权限**：`campus:user:invite`

**请求体**
```json
{
  "email": "user@example.com",
  "redirectTo": "https://app.example.com/auth/callback",
  "name": "张三",
  "studentId": "2023000000000001",
  "roleIds": ["uuid"],
  "departmentIds": ["uuid"],
  "positionIds": ["uuid"]
}
```

**响应（200）**
```json
{ "userId": "uuid" }
```

### 2.5 审核通过：POST `/api/console/users/:id/approve`

**权限**：`campus:user:approve`  
**请求体**
```json
{ "reason": "string (可选)" }
```

### 2.6 停用/启用：POST `/api/console/users/:id/disable`、POST `/api/console/users/:id/enable`

**权限**：`campus:user:disable`  
**请求体**
```json
{ "reason": "string (可选)" }
```

### 2.7 封禁/解封（Auth）：POST `/api/console/users/:id/ban`、POST `/api/console/users/:id/unban`

**权限**：`campus:user:ban`  
**请求体（ban）**
```json
{ "duration": "2h45m | none(不允许) | 也可不传表示永久", "reason": "string (可选)" }
```

### 2.8 删除（Auth）：DELETE `/api/console/users/:id`

**权限**：`campus:user:delete`  
**查询参数**
- `soft`：boolean，默认 `true`（MVP：只允许 soft delete）

### 2.9 分配：PUT `/api/console/users/:id/roles`、PUT `/api/console/users/:id/departments`、PUT `/api/console/users/:id/positions`

**权限**
- 角色：`campus:user:assign_role`
- 部门/岗位：`campus:user:assign_org`

**请求体示例（roles）**
```json
{ "roleIds": ["uuid"] }
```

## 3. 角色与权限（Console）

### 3.1 角色列表：GET `/api/console/roles`
**权限**：`campus:role:*`

### 3.2 角色创建：POST `/api/console/roles`
**权限**：`campus:role:*`  
**请求体**
```json
{ "code": "librarian", "name": "图书管理员", "description": "..." }
```

### 3.3 角色更新/删除：PATCH `/api/console/roles/:id`、DELETE `/api/console/roles/:id`
**权限**：`campus:role:*`

### 3.4 角色权限维护：PUT `/api/console/roles/:id/permissions`
**权限**：`campus:role:*`  
**请求体**
```json
{ "permissionCodes": ["campus:notice:*", "campus:library:*"] }
```

### 3.5 权限字典：GET `/api/console/permissions`
**权限**：`campus:permission:*`  
**说明**：MVP 建议只读（权限码由迁移/代码声明式注册）。

