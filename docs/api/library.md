# 数字图书馆模块 API 契约（MVP）

**状态**：✅ 已实现（MVP）  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-20

> 需求来源：`docs/requirements/library.md`（已冻结 ✅）  
> 约定：Portal 端仅要求登录（`requireUser`）；Console 端按权限码（RBAC）控制。

## 1. 通用约定

### 1.1 认证与鉴权

- Portal：
  - 需要登录（401：`UNAUTHORIZED`）
  - 不要求权限码（403 不出现）
- Console：
  - 需要登录
  - 需要权限码（403：`FORBIDDEN`）

### 1.2 错误码（建议）

- `BAD_REQUEST`（400）：参数校验失败
- `UNAUTHORIZED`（401）：未登录
- `FORBIDDEN`（403）：无权限
- `NOT_FOUND`（404）：资源不存在或不可见
- `CONFLICT`（409）：状态冲突/唯一性冲突
- `INTERNAL_ERROR`（500）：未知错误

## 2. 数据结构（DTO）

### 2.1 BookStatus / AssetType / FileFormat

- `status`：`draft|pending|published|rejected|unpublished`
- `assetType`：`file|link`
- `fileFormat`：`pdf|epub|mobi|zip`

### 2.2 LibraryBookListItem（Portal/我的/榜单复用）

```json
{
  "id": "uuid",
  "isbn13": "9787111122333",
  "title": "string",
  "author": "string",
  "summary": "string|null",
  "keywords": "string|null",
  "status": "draft|pending|published|rejected|unpublished",
  "downloadCount": 12,
  "assetFormats": ["pdf", "epub"],
  "hasLinkAssets": true,
  "isFavorite": false,
  "submittedAt": "2025-12-01T10:00:00Z|null",
  "reviewedAt": "2025-12-01T10:00:00Z|null",
  "publishedAt": "2025-12-01T10:00:00Z|null",
  "unpublishedAt": "2025-12-01T10:00:00Z|null",
  "createdBy": "uuid",
  "authorName": "string|null",
  "createdAt": "2025-12-01T10:00:00Z",
  "updatedAt": "2025-12-01T10:00:00Z"
}
```

### 2.3 LibraryBookAsset

```json
{
  "id": "uuid",
  "assetType": "file|link",
  "fileFormat": "pdf|epub|mobi|zip|null",
  "file": {
    "bucket": "string",
    "key": "string",
    "fileName": "string",
    "size": 123
  },
  "link": {
    "url": "https://example.com/abc",
    "normalizedUrl": "https://example.com/abc"
  },
  "createdAt": "2025-12-01T10:00:00Z"
}
```

### 2.4 LibraryBookDetail

```json
{
  "id": "uuid",
  "isbn13": "9787111122333",
  "title": "string",
  "author": "string",
  "summary": "string|null",
  "keywords": "string|null",
  "status": "draft|pending|published|rejected|unpublished",
  "assets": [/* LibraryBookAsset[] */],
  "isFavorite": false,
  "review": {
    "reviewedBy": "uuid|null",
    "reviewedAt": "2025-12-01T10:00:00Z|null",
    "comment": "string|null"
  },
  "submittedAt": "2025-12-01T10:00:00Z|null",
  "publishedAt": "2025-12-01T10:00:00Z|null",
  "unpublishedAt": "2025-12-01T10:00:00Z|null",
  "downloadCount": 12,
  "lastDownloadAt": "2025-12-01T10:00:00Z|null",
  "createdBy": "uuid",
  "authorName": "string|null",
  "authorEmail": "string|null",
  "createdAt": "2025-12-01T10:00:00Z",
  "updatedBy": "uuid|null",
  "updatedAt": "2025-12-01T10:00:00Z"
}
```

### 2.5 Leaderboard：图书下载榜

```json
{
  "days": 30,
  "items": [
    {
      "book": { /* LibraryBookListItem */ },
      "windowDownloadCount": 123
    }
  ]
}
```

### 2.6 Leaderboard：用户贡献榜

```json
{
  "days": 30,
  "items": [
    {
      "userId": "uuid",
      "name": "string",
      "publishedBookCount": 12
    }
  ]
}
```

## 3. Portal（/api/library/**）

### 3.1 列表：GET `/api/library`

**认证**：登录  
**Query**
- `q`：关键词（标题/作者/ISBN/关键词，OR 匹配，可选）
- `format`：`pdf|epub|mobi|zip`（可选；过滤“至少包含该格式文件资产”的图书）
- `sortBy`：`publishedAt|downloadCount`（可选，默认 `publishedAt`）
- `sortOrder`：`asc|desc`（可选，默认 `desc`）
- `page`：默认 1
- `pageSize`：默认 20，最大 50

**响应（200）**：`{ page, pageSize, total, items: LibraryBookListItem[] }`  
**说明**：仅返回 `status=published`。

### 3.2 详情：GET `/api/library/:id`

**认证**：登录  
**响应（200）**：`LibraryBookDetail`  
**说明**：仅允许查看 `status=published`。

### 3.3 下载：POST `/api/library/:id/download`

**认证**：登录  
**Body（可选）**

```json
{ "assetId": "uuid" }
```

**响应（302）**：重定向到 signed url 或外链  
**说明**：
- 未传 `assetId` 时，服务端按默认策略选择资产（优先 `pdf > epub > mobi > zip > link`）。
- 成功下载会写入下载事件并更新 `downloadCount/lastDownloadAt`。

### 3.4 收藏/取消：POST `/api/library/:id/favorite`

**认证**：登录  
**Body**

```json
{ "favorite": true }
```

**响应（200）**

```json
{ "ok": true, "favorite": true }
```

## 4. 榜单（/api/library/leaderboard/**）

### 4.1 图书下载榜：GET `/api/library/leaderboard/books?days=<7|30|365>`

**认证**：登录  
**Query**
- `days`：可选；缺省表示总榜；存在时仅允许 `7|30|365`

**响应（200）**：Leaderboard DTO（2.5）

### 4.2 用户贡献榜：GET `/api/library/leaderboard/users?days=<7|30|365>`

**认证**：登录  
**Query**
- `days`：可选；缺省表示总榜；存在时仅允许 `7|30|365`

**响应（200）**：Leaderboard DTO（2.6）

## 5. 我的（/api/me/library/**）

### 5.1 我的投稿列表：GET `/api/me/library/books`

**认证**：登录  
**Query**
- `status`：`draft|pending|published|rejected|unpublished`（可选）
- `q`：关键词（标题/作者/ISBN/关键词，OR 匹配，可选）
- `page/pageSize`：同上

**响应（200）**：分页 `LibraryBookListItem[]`

### 5.2 创建草稿：POST `/api/me/library/books`

**认证**：登录  
**Body**

```json
{
  "isbn13": "978-7-111-12233-3",
  "title": "string",
  "author": "string",
  "summary": "string|null",
  "keywords": "string|null"
}
```

**响应（201）**：`LibraryBookDetail`（`status=draft`）

### 5.3 草稿详情：GET `/api/me/library/books/:id`

**认证**：登录  
**响应（200）**：`LibraryBookDetail`

### 5.4 更新草稿：PATCH `/api/me/library/books/:id`

**认证**：登录  
**Body**：可选字段集合（同 5.2）  
**响应（200）**：`LibraryBookDetail`  
**说明**：仅允许 `draft/rejected/unpublished` 修改。

### 5.5 删除草稿：DELETE `/api/me/library/books/:id`

**认证**：登录  
**响应（200）**：`{ ok: true }`  
**说明**：仅允许 `draft/rejected/unpublished` 删除。

### 5.6 提交审核：POST `/api/me/library/books/:id/submit`

**认证**：登录  
**响应（200）**：`LibraryBookDetail`（`status=pending`）  
**说明**：至少包含 1 个资产才允许提交。

### 5.7 下架：POST `/api/me/library/books/:id/unpublish`

**认证**：登录  
**响应（200）**：`LibraryBookDetail`（`status=unpublished`）  
**说明**：仅 `published` 可下架。

### 5.8 我的收藏：GET `/api/me/library/favorites`

**认证**：登录  
**Query**：`page/pageSize`  
**响应（200）**：分页 `LibraryBookListItem[]`（仅 `published`）

## 6. 资产（/api/me/library/books/:id/assets/**）

### 6.1 生成文件上传链接：POST `/api/me/library/books/:id/assets/upload-url`

**认证**：登录  
**Body**

```json
{
  "format": "pdf",
  "fileName": "xxx.pdf",
  "size": 123
}
```

**响应（200）**

```json
{
  "assetId": "uuid",
  "bucket": "library-books",
  "key": "library/<bookId>/<assetId>/...",
  "token": "string",
  "uploadUrl": "https://...signed..."
}
```

**说明**：仅允许 `draft/rejected/unpublished`；服务端校验扩展名与 size（≤100MB）。

### 6.2 添加外链资产：POST `/api/me/library/books/:id/assets/link`

**认证**：登录  
**Body**

```json
{ "url": "https://example.com/book.pdf" }
```

**响应（200）**：`LibraryBookDetail`  
**说明**：服务端执行 URL 规范化并按 book 维度去重。

### 6.3 删除资产：DELETE `/api/me/library/books/:id/assets/:assetId`

**认证**：登录  
**响应（200）**：`LibraryBookDetail`  
**说明**：仅允许 `draft/rejected/unpublished`；文件资产会清理存储对象。

## 7. Console（/api/console/library/**）

### 7.1 列表：GET `/api/console/library/books`

**认证**：登录 + `campus:library:list`  
**Query**
- `status`：可选
- `q`：关键词（标题/作者/ISBN/关键词）
- `page/pageSize`

**响应（200）**：分页 `LibraryBookListItem[]`

### 7.2 详情：GET `/api/console/library/books/:id`

**认证**：登录 + `campus:library:read`  
**响应（200）**：`LibraryBookDetail`

### 7.3 审核通过：POST `/api/console/library/books/:id/approve`

**认证**：登录 + `campus:library:review`  
**Body（可选）**

```json
{ "comment": "string|null", "reason": "string|null" }
```

**响应（200）**：`LibraryBookDetail`（`status=published`）

### 7.4 审核驳回：POST `/api/console/library/books/:id/reject`

**认证**：登录 + `campus:library:review`  
**Body**

```json
{ "comment": "string", "reason": "string|null" }
```

**响应（200）**：`LibraryBookDetail`（`status=rejected`）

### 7.5 下架：POST `/api/console/library/books/:id/offline`

**认证**：登录 + `campus:library:offline`  
**Body（可选）**

```json
{ "reason": "string|null" }
```

**响应（200）**：`LibraryBookDetail`（`status=unpublished`）

### 7.6 管理端下载：POST `/api/console/library/books/:id/download`

**认证**：登录 + `campus:library:read`  
**Body（可选）**：同 3.3  
**响应（302）**：重定向到 signed url 或外链  
**说明**：用于审核预览；不写入下载榜（是否计数以实现为准，MVP 默认不计）。

### 7.7 硬删除：DELETE `/api/console/library/books/:id?reason=...`

**认证**：登录 + `campus:library:delete`  
**响应（200）**：`{ ok: true }`
