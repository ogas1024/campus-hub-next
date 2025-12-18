# 课程资源分享模块 API 契约（MVP 草案）

**状态**：🟠 待冻结（等待确认）  
**版本**：v1.0-draft（MVP）  
**最近更新**：2025-12-18

> 需求来源：`docs/requirements/course-resources.md`（待冻结）  
> 约定：Portal 端仅要求登录（`requireUser`）；Console 端按权限码（RBAC）控制，并在 Service 层强制执行 `major_lead` 的专业范围过滤。

## 1. 通用约定

### 1.1 认证与鉴权

- Portal：
  - 需要登录（401：`UNAUTHORIZED`）
  - 不要求权限码（403 不出现）
- Console：
  - 需要登录
  - 需要权限码（403：`FORBIDDEN`）
  - 对 `major_lead` 额外施加“领域范围”：仅允许操作其负责专业的数据

### 1.2 错误码（建议）

- `BAD_REQUEST`（400）：参数校验失败
- `UNAUTHORIZED`（401）：未登录
- `FORBIDDEN`（403）：无权限或越权访问（含跨专业访问）
- `NOT_FOUND`（404）：资源不存在或不可见
- `CONFLICT`（409）：状态冲突/去重冲突
- `INTERNAL_ERROR`（500）：未知错误

## 2. 数据结构（DTO）

### 2.1 Major

```json
{
  "id": "uuid",
  "name": "string",
  "enabled": true,
  "sort": 0
}
```

### 2.2 Course

```json
{
  "id": "uuid",
  "majorId": "uuid",
  "name": "string",
  "code": "string|null",
  "enabled": true,
  "sort": 0
}
```

### 2.3 ResourceStatus / ResourceType

- `status`：`draft|pending|published|rejected|unpublished`
- `resourceType`：`file|link`

### 2.4 CourseResourceListItem（Portal/榜单复用）

```json
{
  "id": "uuid",
  "majorId": "uuid",
  "courseId": "uuid",
  "title": "string",
  "description": "string",
  "resourceType": "file|link",
  "status": "draft|pending|published|rejected|unpublished",
  "downloadCount": 12,
  "isBest": false,
  "publishedAt": "2025-12-01T10:00:00Z",
  "createdBy": "uuid",
  "createdAt": "2025-12-01T10:00:00Z"
}
```

### 2.5 CourseResourceDetail

```json
{
  "id": "uuid",
  "majorId": "uuid",
  "courseId": "uuid",
  "title": "string",
  "description": "string",
  "resourceType": "file|link",
  "status": "draft|pending|published|rejected|unpublished",
  "file": {
    "bucket": "string",
    "key": "string",
    "fileName": "string",
    "size": 123,
    "sha256": "hex",
    "downloadUrl": "https://...signed..."
  },
  "link": {
    "url": "https://example.com/abc",
    "normalizedUrl": "https://example.com/abc"
  },
  "review": {
    "reviewedBy": "uuid|null",
    "reviewedAt": "2025-12-01T10:00:00Z|null",
    "comment": "string|null"
  },
  "publishedAt": "2025-12-01T10:00:00Z|null",
  "unpublishedAt": "2025-12-01T10:00:00Z|null",
  "downloadCount": 12,
  "isBest": false,
  "createdBy": "uuid",
  "createdAt": "2025-12-01T10:00:00Z"
}
```

### 2.6 Leaderboard：资源下载榜

```json
{
  "scope": "global|major|course",
  "days": 30,
  "items": [
    {
      "resource": { /* CourseResourceListItem */ },
      "windowDownloadCount": 123
    }
  ]
}
```

### 2.7 Leaderboard：用户积分榜（含代表作 Top5）

```json
{
  "majorId": "uuid|null",
  "items": [
    {
      "userId": "uuid",
      "name": "string",
      "score": 15,
      "approveCount": 1,
      "bestCount": 1,
      "topWorks": [ /* CourseResourceListItem[]（最多 5 条） */ ]
    }
  ]
}
```

## 3. Portal（/api/resources/**）

### 3.1 专业列表：GET `/api/resources/majors`

**认证**：登录  
**响应（200）**：`Major[]`  
**说明**：Portal 侧仅返回 `enabled=true` 的专业。

### 3.2 课程列表：GET `/api/resources/courses?majorId=<uuid>`

**认证**：登录  
**响应（200）**：`Course[]`  
**说明**：Portal 侧仅返回 `enabled=true` 的课程。

### 3.3 资源列表：GET `/api/resources?courseId=<uuid>&q=<string?>&page=<n>&pageSize=<n>`

**认证**：登录  
**规则**：仅返回 `published`；`isBest=true` 的资源置顶  
**响应（200）**

```json
{ "page": 1, "pageSize": 20, "total": 123, "items": [/* CourseResourceListItem[] */] }
```

### 3.4 资源详情：GET `/api/resources/:id`

**认证**：登录  
**规则**：仅允许读取 `published`  
**响应（200）**：`CourseResourceDetail`

### 3.5 下载：POST `/api/resources/:id/download`

**认证**：登录  
**规则**
- 记录下载事件并更新计数
- 文件：生成短时 signed url
- 外链：302 跳转至规范化 URL

**响应**
- `302`：重定向到下载地址（推荐实现）
- 或 `200`：返回 `{ "url": "https://..." }` 由前端跳转（可选实现）

### 3.6 资源下载榜：GET `/api/resources/leaderboard/resources?scope=global|major|course&majorId?&courseId?&days=30`

**认证**：登录  
**响应（200）**：Leaderboard（资源下载榜）

### 3.7 用户积分榜：GET `/api/resources/leaderboard/users?majorId?`

**认证**：登录  
**响应（200）**：Leaderboard（用户积分榜）

### 3.8 用户代表作（抽屉）：GET `/api/resources/leaderboard/users/:userId/works?majorId?&q?&courseId?&best?&sortBy=downloadCount|publishedAt&sortOrder=desc|asc`

**认证**：登录  
**响应（200）**：分页的 `CourseResourceListItem[]`（通常为该用户已发布资源）

## 4. Portal（/api/me/resources/**）

### 4.1 我的资源列表：GET `/api/me/resources`

**认证**：登录  
**响应（200）**：分页列表（可包含全部状态）

### 4.2 创建草稿：POST `/api/me/resources`

**认证**：登录  
**请求体（示例）**

```json
{ "majorId": "uuid", "courseId": "uuid", "title": "string", "description": "string", "resourceType": "file|link" }
```

**响应（201）**：`CourseResourceDetail`（status=draft）

### 4.3 更新草稿：PUT `/api/me/resources/:id`

**认证**：登录  
**规则**：仅允许 `draft/rejected/unpublished` 修改；`pending/published` 拒绝（409）  
**响应（200）**：`CourseResourceDetail`

### 4.4 删除（软删）：DELETE `/api/me/resources/:id`

**认证**：登录  
**规则**：仅允许 `draft/rejected/unpublished`  
**响应（200）**：`{ "ok": true }`

### 4.5 提交审核：POST `/api/me/resources/:id/submit`

**认证**：登录  
**规则**
- 仅允许 `draft/rejected/unpublished -> pending`
- 强制执行去重校验（sha256 / normalizedUrl）；重复则 409

**响应（200）**：`CourseResourceDetail`（status=pending）

### 4.6 下架：POST `/api/me/resources/:id/unpublish`

**认证**：登录  
**规则**：仅允许作者对 `published -> unpublished`  
**响应（200）**：`CourseResourceDetail`

### 4.7 上传签名：POST `/api/me/resources/:id/upload-url`

**认证**：登录  
**请求体（示例）**

```json
{ "fileName": "xxx.zip", "size": 123, "sha256": "hex" }
```

**规则**
- 校验扩展名仅 `zip/rar/7z`
- 校验 `size <= 200MB`
- 返回短时上传 URL，客户端直传对象存储

**响应（200）**

```json
{ "bucket": "course-resources", "key": "resources/<id>/<uuid>-xxx.zip", "token": "string", "uploadUrl": "https://...signed..." }
```

## 5. Console（/api/console/resources/**）

> 权限码建议见：`docs/requirements/course-resources.md` 与 `docs/ops/role-permission-matrix.md`（待迁移落地）。

### 5.1 专业（admin/super_admin）

- `GET /api/console/resources/majors`：列表
- `POST /api/console/resources/majors`：创建
- `PUT /api/console/resources/majors/:id`：更新
- `DELETE /api/console/resources/majors/:id`：删除（MVP 建议软删）

### 5.2 专业负责人（admin/super_admin）

- `GET /api/console/resources/majors/:id/leads`：查询负责人
- `PUT /api/console/resources/majors/:id/leads`：覆盖设置负责人（多个 userId）

### 5.3 课程（admin 全量 / major_lead 仅本专业）

- `GET /api/console/resources/courses?majorId?`：列表
- `POST /api/console/resources/courses`：创建
- `PUT /api/console/resources/courses/:id`：更新
- `DELETE /api/console/resources/courses/:id`：删除

### 5.4 资源审核与管理（admin 全量 / major_lead 仅本专业）

- `GET /api/console/resources`：列表（支持 status/majorId/courseId/q）
- `GET /api/console/resources/:id`：详情
- `POST /api/console/resources/:id/download`：下载/打开资源（不计数；用于审核核验，可用于 pending 等状态）
- `POST /api/console/resources/:id/approve`：审核通过（可选 comment）
- `POST /api/console/resources/:id/reject`：审核驳回（必填 comment）
- `POST /api/console/resources/:id/offline`：下架（published -> unpublished）
- `POST /api/console/resources/:id/best`：标记最佳
- `POST /api/console/resources/:id/unbest`：取消最佳

### 5.5 硬删除（仅 admin/super_admin）

- `DELETE /api/console/resources/:id`：硬删除（仅删库，不删 Storage 对象）
