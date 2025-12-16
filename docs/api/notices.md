# 通知公告模块 API 契约（MVP）

**状态**：✅ 已实现（MVP）  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-16

> 需求来源：`docs/requirements/notices.md`（已冻结 ✅）

## 1. 通用约定

### 1.1 认证与权限

- 阅读端：仅要求登录（`requireUser`），不强制权限码。
- 管理端：需要权限码；并包含“资源级授权”（默认只能操作自己创建的公告，拥有 `campus:notice:manage` 或管理员角色可操作全量）。

### 1.2 公告状态

- `draft`：草稿
- `published`：已发布
- `retracted`：已撤回

### 1.3 可见范围（OR 逻辑）

- `visibleAll=true`：全员可见
- `visibleAll=false`：至少 1 条 scope；用户命中 role / department / position 任一即可见

### 1.4 错误码（建议）

- `BAD_REQUEST`：参数校验失败（400）
- `UNAUTHORIZED`：未登录（401）
- `FORBIDDEN`：无权限（403）
- `NOT_FOUND`：资源不存在或不可见（404）
- `CONFLICT`：状态冲突（409）
- `INTERNAL_ERROR`：未知错误（500）

## 2. 数据结构（DTO）

### 2.1 NoticeListItem

```json
{
  "id": "uuid",
  "title": "string",
  "status": "draft|published|retracted",
  "visibleAll": true,
  "pinned": false,
  "pinnedAt": "2025-12-01T10:00:00Z",
  "publishAt": "2025-12-01T10:00:00Z",
  "expireAt": "2025-12-31T10:00:00Z",
  "isExpired": false,
  "createdBy": "uuid",
  "createdAt": "2025-12-01T10:00:00Z",
  "updatedAt": "2025-12-01T10:00:00Z",
  "editCount": 0,
  "readCount": 12,
  "read": true
}
```

### 2.2 NoticeDetail

```json
{
  "id": "uuid",
  "title": "string",
  "contentMd": "string",
  "status": "draft|published|retracted",
  "visibleAll": true,
  "scopes": [
    { "scopeType": "role|department|position", "refId": "uuid" }
  ],
  "pinned": false,
  "pinnedAt": null,
  "publishAt": null,
  "expireAt": null,
  "isExpired": false,
  "createdBy": "uuid",
  "createdAt": "2025-12-01T10:00:00Z",
  "updatedBy": "uuid",
  "updatedAt": "2025-12-01T10:00:00Z",
  "editCount": 0,
  "readCount": 12,
  "read": true,
  "attachments": [
    {
      "id": "uuid",
      "fileName": "example.pdf",
      "contentType": "application/pdf",
      "size": 12345,
      "downloadUrl": "https://...signed..."
    }
  ]
}
```

## 3. 阅读端（Portal）

### 3.1 列表：GET `/api/notices`

**认证**：需要登录  
**查询参数**

- `page`：number，默认 1
- `pageSize`：number，默认 20，最大 50
- `q`：string，标题关键词（可选）
- `includeExpired`：boolean，默认 `false`
- `read`：`true|false`（可选）
- `sortBy`：`publishAt|updatedAt|expireAt`（默认 `publishAt`）
- `sortOrder`：`asc|desc`（默认 `desc`；置顶永远优先）

**响应（200）**

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 123,
  "items": [/* NoticeListItem[] */]
}
```

### 3.2 详情：GET `/api/notices/:id`

**认证**：需要登录  
**说明**

- 默认仅返回“当前用户可见”的公告详情。
- 若用户为创建者或拥有管理权限，可读取自己的草稿/撤回公告。

**响应（200）**：`NoticeDetail`

### 3.3 记录已读：POST `/api/notices/:id/read`

**认证**：需要登录  
**说明**

- 幂等：同一用户对同一公告只会生成 1 条阅读回执。

**响应（200）**

```json
{ "ok": true }
```

## 4. 管理端（Console）

> 所有 `/api/console/**` 接口默认要求具备对应权限码；同时做资源级授权。

### 4.1 列表：GET `/api/console/notices`

**权限**：`campus:notice:list`  
**查询参数**

- `page` / `pageSize`：同阅读端
- `q`：string（可选）
- `status`：`draft|published|retracted`（可选）
- `includeExpired`：boolean（默认 `true`，管理端更常用）
- `mine`：boolean（默认 `false`；仅查看我创建的）

**响应（200）**：同阅读端列表结构，但 `items[].read` 可省略或固定为 `null`

### 4.2 获取详情（用于编辑）：GET `/api/console/notices/:id`

**权限**：`campus:notice:list`  
**响应（200）**：`NoticeDetail`（包含 scopes 与附件元数据；`downloadUrl` 可选返回）

### 4.3 创建：POST `/api/console/notices`

**权限**：`campus:notice:create`  
**请求体**

```json
{
  "title": "string",
  "contentMd": "string",
  "expireAt": "2025-12-31T10:00:00Z",
  "visibleAll": false,
  "scopes": [
    { "scopeType": "role|department|position", "refId": "uuid" }
  ],
  "attachments": [
    {
      "fileKey": "notices/<noticeId>/<uuid>-example.pdf",
      "fileName": "example.pdf",
      "contentType": "application/pdf",
      "size": 12345,
      "sort": 0
    }
  ]
}
```

**规则**

- `title` 必填，<=200
- `contentMd` 必填（不允许内联 HTML）
- `visibleAll=false` 时 scopes 至少 1 条

**响应（201）**：`NoticeDetail`

### 4.4 更新：PUT `/api/console/notices/:id`

**权限**：`campus:notice:update`  
**说明**

- 覆盖式保存：`attachments` 与 `scopes` 以请求体为准覆盖写入。
- 每次更新成功：`editCount + 1`。

**请求体**：同创建（可允许部分字段可选，具体实现以 Zod 校验为准）  
**响应（200）**：`NoticeDetail`

### 4.5 删除（软删）：DELETE `/api/console/notices/:id`

**权限**：`campus:notice:delete`  
**响应（200）**

```json
{ "ok": true }
```

### 4.6 发布/撤回：POST `/api/console/notices/:id/publish`、POST `/api/console/notices/:id/retract`

**权限**：`campus:notice:publish`  

**规则**

- 幂等：重复发布/撤回直接成功返回。
- 撤回会自动取消置顶（`pinned=false, pinnedAt=null`）。

**响应（200）**：`NoticeDetail`

### 4.7 置顶：POST `/api/console/notices/:id/pin`

**权限**：`campus:notice:pin`  
**请求体**

```json
{ "pinned": true }
```

**规则**

- 仅对“已发布且未过期”的公告允许置顶；撤回后自动取消置顶。
- 幂等：重复设置同值直接成功返回。

**响应（200）**：`NoticeDetail`

### 4.8 上传附件（服务端代理上传）：POST `/api/console/notices/:id/attachments`

**权限**：`campus:notice:update`（新建页面也可能用到；实现时可放宽为 create/update）  
**请求**：`multipart/form-data`

- `file`：必填

**响应（201）**

```json
{
  "id": "uuid",
  "fileKey": "notices/<noticeId>/<uuid>-example.pdf",
  "fileName": "example.pdf",
  "contentType": "application/pdf",
  "size": 12345
}
```

> 说明：本接口只负责“上传到 Storage 并返回 fileKey + 元数据”；公告的附件记录以创建/更新接口的 `attachments` 覆盖式保存为准。

### 4.9 可见范围选项：GET `/api/console/notices/scope-options`

**权限**：`campus:notice:create` 或 `campus:notice:update`  
**响应（200）**

```json
{
  "roles": [{ "id": "uuid", "name": "staff" }],
  "departments": [{ "id": "uuid", "name": "信息工程学院", "parentId": null }],
  "positions": [{ "id": "uuid", "name": "辅导员" }]
}
```
