# 失物招领模块 API 契约（MVP）

**状态**：✅ 已实现（MVP）  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-21

> 需求来源：`docs/requirements/lostfound.md`（已冻结 ✅）

## 1. 通用约定

### 1.1 认证与权限
- Portal（`/api/lostfound/**`）：仅要求登录（`requireUser`），不强制权限码。
- Me（`/api/me/lostfound/**`）：仅要求登录（`requireUser`），且资源必须属于本人。
- Console（`/api/console/lostfound/**`）：按权限码校验（`requirePerm`）。

### 1.2 错误结构

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "人类可读信息",
    "details": {}
  }
}
```

### 1.3 枚举

- `LostFoundType`：`lost|found`
- `LostFoundStatus`：`pending|published|rejected|offline`

### 1.4 图片与存储（冻结）
- Bucket：`lostfound`（private）
- 上传：BFF 统一上传 `POST /api/me/lostfound/images`（`multipart/form-data`，字段名 `file`）
- 返回：仅返回 `signedUrl`（短期有效），不返回公开 URL
- 限制：≤9 张；`jpg/jpeg/png/webp`；≤2MB/张
- 列表：仅返回封面图（首图）；详情返回完整图片数组

## 2. DTO

### 2.1 Image

```json
{
  "bucket": "lostfound",
  "key": "users/<uid>/lostfound/<uuid>.webp",
  "signedUrl": "https://...signed..."
}
```

### 2.2 PortalListItem

```json
{
  "id": "uuid",
  "type": "lost|found",
  "title": "string",
  "location": "string|null",
  "occurredAt": "2025-12-21T12:00:00Z|null",
  "publishedAt": "2025-12-21T12:00:00Z",
  "solvedAt": "2025-12-21T12:00:00Z|null",
  "coverImage": null | { "bucket": "lostfound", "key": "string", "signedUrl": "string" }
}
```

### 2.3 PortalDetail

```json
{
  "id": "uuid",
  "type": "lost|found",
  "title": "string",
  "content": "string",
  "location": "string|null",
  "occurredAt": "2025-12-21T12:00:00Z|null",
  "contactInfo": "string|null",
  "status": "published",
  "publishedAt": "2025-12-21T12:00:00Z",
  "solvedAt": "2025-12-21T12:00:00Z|null",
  "images": [/* Image[] */],
  "createdAt": "2025-12-21T12:00:00Z",
  "updatedAt": "2025-12-21T12:00:00Z"
}
```

### 2.4 MyListItem（Portal - 我的发布）

```json
{
  "id": "uuid",
  "type": "lost|found",
  "title": "string",
  "status": "pending|published|rejected|offline",
  "publishedAt": "2025-12-21T12:00:00Z|null",
  "solvedAt": "2025-12-21T12:00:00Z|null",
  "rejectReason": "string|null",
  "offlineReason": "string|null",
  "createdAt": "2025-12-21T12:00:00Z"
}
```

### 2.5 ConsoleListItem

```json
{
  "id": "uuid",
  "type": "lost|found",
  "title": "string",
  "status": "pending|published|rejected|offline",
  "publishedAt": "2025-12-21T12:00:00Z|null",
  "solvedAt": "2025-12-21T12:00:00Z|null",
  "createdBy": { "id": "uuid", "name": "string", "studentId": "string" },
  "createdAt": "2025-12-21T12:00:00Z"
}
```

## 3. Portal（/api/lostfound）

### 3.1 列表：GET `/api/lostfound`
**认证**：需要登录  
**查询参数**
- `type`：`lost|found`（可选）
- `q`：关键词（可选，title/content/location 模糊匹配）
- `solved`：`true|false`（可选；默认 `false` 表示“隐藏已解决”；`true` 表示“包含已解决”）
- `from/to`：ISO 日期时间字符串（可选；按 `publishedAt` 过滤）
- `page`：默认 1
- `pageSize`：默认 20，最大 50

**响应（200）**

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "items": [/* PortalListItem[] */]
}
```

### 3.2 详情：GET `/api/lostfound/:id`
**认证**：需要登录  
**规则**：仅可访问 `published` 且未软删的条目  
**响应（200）**：`PortalDetail`

## 4. Me（/api/me/lostfound）

### 4.1 我的发布列表：GET `/api/me/lostfound`
**认证**：需要登录  
**查询参数**
- `status`：`pending|published|rejected|offline`（可选）
- `q`：关键词（可选，title/content/location 模糊匹配）
- `page/pageSize`

**响应（200）**

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "items": [/* MyListItem[] */]
}
```

### 4.2 创建：POST `/api/me/lostfound`
**认证**：需要登录  
**请求（JSON）**

```json
{
  "type": "lost|found",
  "title": "string(2~50)",
  "content": "string(5~2000)",
  "location": "string<=100|null",
  "occurredAt": "ISO|null",
  "contactInfo": "string<=50|null",
  "imageKeys": ["users/<uid>/lostfound/<uuid>.webp"]
}
```

**规则**
- 默认进入 `pending`（开启审核）
- `imageKeys` 可选，≤9；每个 key 必须以 `users/<currentUserId>/lostfound/` 开头

**响应（201）**

```json
{ "id": "uuid" }
```

### 4.3 我的详情：GET `/api/me/lostfound/:id`
**认证**：需要登录  
**规则**：仅作者本人可访问  
**响应（200）**：包含 `images: Image[]`（signedUrl）

### 4.4 更新：PUT `/api/me/lostfound/:id`
**认证**：需要登录  
**请求（JSON）**：同创建（全部字段可选，但至少 1 个字段）  
**规则**
- 仅作者；`solvedAt != null` 时禁止编辑
- `offline` 状态禁止编辑（需 Console 恢复为 `pending`）
- 编辑后状态重置为 `pending`（重新审核），并清空 `rejectReason/offlineReason`
**响应（200）**
```json
{ "ok": true }
```

### 4.5 软删：DELETE `/api/me/lostfound/:id`
**认证**：需要登录  
**规则**：仅作者；软删后对所有人不可见  
**响应（200）**
```json
{ "ok": true }
```

### 4.6 标记已解决：POST `/api/me/lostfound/:id/solve`
**认证**：需要登录  
**规则**：仅作者；仅 `published` 且 `solvedAt == null` 可标记；标记后不可撤销  
**响应（200）**
```json
{ "ok": true }
```

### 4.7 上传图片：POST `/api/me/lostfound/images`
**认证**：需要登录  
**请求**：`multipart/form-data`
- `file`：File（必填）
**响应（201）**
```json
{
  "bucket": "lostfound",
  "key": "users/<uid>/lostfound/<uuid>.webp",
  "signedUrl": "https://...signed..."
}
```

## 5. Console（/api/console/lostfound）

### 5.1 列表：GET `/api/console/lostfound`
**权限**：`campus:lostfound:list`  
**查询参数**
- `status`：`pending|published|rejected|offline`（可选）
- `type`：`lost|found`（可选）
- `q`：关键词（可选）
- `from/to`：ISO（可选；按 `createdAt` 过滤）
- `page/pageSize`
**响应（200）**：`Paginated<ConsoleListItem>`

### 5.2 详情：GET `/api/console/lostfound/:id`
**权限**：`campus:lostfound:list`  
**响应（200）**：包含作者信息、图片（signedUrl）、审核/下架信息与原因

### 5.3 审核通过：POST `/api/console/lostfound/:id/approve`
**权限**：`campus:lostfound:review`  
**规则**：仅 `pending` 可通过；通过后进入 `published` 并写入 `publishedAt`
**响应（200）**
```json
{ "ok": true }
```

### 5.4 审核驳回：POST `/api/console/lostfound/:id/reject`
**权限**：`campus:lostfound:review`  
**请求（JSON）**
```json
{ "reason": "string(1~500)" }
```
**规则**：仅 `pending` 可驳回
**响应（200）**：`{ "ok": true }`

### 5.5 下架：POST `/api/console/lostfound/:id/offline`
**权限**：`campus:lostfound:offline`  
**请求（JSON）**
```json
{ "reason": "string(1~500)" }
```
**规则**：仅 `published` 可下架
**响应（200）**：`{ "ok": true }`

### 5.6 恢复为待审：POST `/api/console/lostfound/:id/restore`
**权限**：`campus:lostfound:restore`  
**规则**：仅 `rejected|offline` 可恢复；恢复后进入 `pending`
**响应（200）**：`{ "ok": true }`

### 5.7 软删清理：DELETE `/api/console/lostfound/:id`
**权限**：`campus:lostfound:delete`  
**说明**：仅用于清理明显违规/重复数据；软删后对所有人不可见  
**响应（200）**：`{ "ok": true }`
