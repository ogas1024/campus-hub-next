# 材料收集模块 API 契约（MVP）

**状态**：✅ 已实现（MVP）  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-20

> 需求来源：`docs/requirements/materials.md`（已冻结 ✅）

## 1. 通用约定

### 1.1 认证与权限
- Portal：仅要求登录（`requireUser`），不强制权限码。
- Console：需要权限码；并包含“资源级授权/数据范围”约束（默认只能操作自己创建的任务；`campus:material:manage` 可在 DataScope 范围内操作他人创建的任务与提交，但不越过 DataScope）。

### 1.2 错误码（建议）
- `BAD_REQUEST`（400）
- `UNAUTHORIZED`（401）
- `FORBIDDEN`（403）
- `NOT_FOUND`（404）
- `CONFLICT`（409）
- `INTERNAL_ERROR`（500）

## 2. DTO

### 2.1 Scope

```json
{ "scopeType": "role|department|position", "refId": "uuid" }
```

### 2.2 MaterialItem

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string|null",
  "required": true,
  "sort": 0,
  "template": null | {
    "fileName": "模板.docx",
    "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 12345,
    "downloadUrl": "https://...signed..."
  }
}
```

### 2.3 SubmissionFile

```json
{
  "id": "uuid",
  "itemId": "uuid",
  "fileName": "a.docx",
  "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "size": 12345,
  "downloadUrl": "https://...signed..."
}
```

### 2.4 MySubmission（Portal）

```json
{
  "id": "uuid",
  "submittedAt": "2025-12-20T12:00:00Z|null",
  "withdrawnAt": "2025-12-20T12:00:00Z|null",
  "status": "pending|complete|need_more|approved|rejected",
  "studentMessage": "string|null",
  "missingRequired": false,
  "files": [/* SubmissionFile[] */]
}
```

### 2.5 dueAt / canSubmit
- `dueAt`：截止时间（ISO 字符串或 `null`）。发布时要求非空且晚于当前时间。
- `canSubmit`：后端计算的可提交标记（`status=published && now <= dueAt`）。

## 3. Portal（/api/materials）

### 3.1 列表：GET `/api/materials`
**认证**：需要登录  
**查询参数**
- `page`：默认 1
- `pageSize`：默认 20，最大 50
- `q`：标题关键词（可选）
**响应（200）**
```json
{
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "items": [
    {
      "id": "uuid",
      "title": "string",
      "status": "published|closed",
      "noticeId": "uuid|null",
      "dueAt": "2025-12-20T12:00:00Z|null",
      "canSubmit": true,
      "updatedAt": "2025-12-20T12:00:00Z"
    }
  ]
}
```

### 3.2 详情：GET `/api/materials/:id`
**认证**：需要登录  
**响应（200）**

```json
{
  "id": "uuid",
  "title": "string",
  "descriptionMd": "string",
  "status": "published|closed",
  "maxFilesPerSubmission": 10,
  "dueAt": "2025-12-20T12:00:00Z|null",
  "canSubmit": true,
  "notice": null | { "id": "uuid", "title": "string" },
  "items": [/* MaterialItem[] */],
  "mySubmission": {/* MySubmission | null */}
}
```

### 3.3 上传文件：POST `/api/materials/:id/files`
**认证**：需要登录  
**请求**：`multipart/form-data`
- `itemId`：uuid
- `file`：File

### 3.4 删除文件：DELETE `/api/materials/:id/files/:fileId`
**认证**：需要登录  
**说明**：仅能删除本人提交中的文件；删除会物理删除 Storage 对象。

### 3.5 提交/覆盖提交：POST `/api/materials/:id/submit`
**认证**：需要登录  
**说明**：校验必交项已满足；写入 `submittedAt`；处理状态重置为 `pending`。

### 3.6 撤回：POST `/api/materials/:id/withdraw`
**认证**：需要登录  
**说明**：撤回后立即物理删除全部文件对象并清空文件记录。

## 4. Console（/api/console/materials）

### 4.1 可见范围选项：GET `/api/console/materials/scope-options`
**权限**：`campus:material:create` 或 `campus:material:update`

### 4.2 列表：GET `/api/console/materials`
**权限**：`campus:material:list`  
**查询参数**
- `status`：`draft|published|closed`（可选）
- `archived`：`true|false`（默认 false）
- `q`：标题关键词（可选）
- `mine`：`true|false`（默认 false）
- `page/pageSize`

### 4.3 详情：GET `/api/console/materials/:id`
**权限**：`campus:material:read`

### 4.4 创建草稿：POST `/api/console/materials`
**权限**：`campus:material:create`

### 4.5 更新草稿：PUT `/api/console/materials/:id`
**权限**：`campus:material:update`

### 4.6 任务动作（发布/关闭/归档/截止）
#### 4.6.1 发布：POST `/api/console/materials/:id/publish`
**权限**：`campus:material:publish`  
**规则**
- 幂等：重复发布直接成功返回。
- 发布前校验：
  - `dueAt` 非空且晚于当前时间
  - 至少 1 个材料项
  - 未关联公告且 `visibleAll=false` 时，`scopes` 不能为空
**响应（200）**：`ConsoleMaterialDetail`

#### 4.6.2 关闭：POST `/api/console/materials/:id/close`
**权限**：`campus:material:close`  
**规则**
- 幂等：重复关闭直接成功返回。
- 仅已发布任务允许关闭。
**响应（200）**：`ConsoleMaterialDetail`

#### 4.6.3 归档：POST `/api/console/materials/:id/archive`
**权限**：`campus:material:archive`  
**规则**
- 幂等：重复归档直接成功返回。
- 仅已关闭任务允许归档；归档后 Portal 列表隐藏。
**响应（200）**：`ConsoleMaterialDetail`

#### 4.6.4 更新截止时间：POST `/api/console/materials/:id/due`
**权限**：`campus:material:update`  
**请求**
```json
{ "dueAt": "2025-12-20T12:00:00Z" }
```
**规则**
- 已归档任务不允许修改截止时间。
- 发布后仅允许修改截止时间（结构仍锁定）。

### 4.7 上传材料项模板：POST `/api/console/materials/:id/items/:itemId/template`
**权限**：`campus:material:update`  
**请求**：`multipart/form-data`：`file`

### 4.8 提交列表：GET `/api/console/materials/:id/submissions`
**权限**：`campus:material:process`  
**查询参数**
- `q`：学号/姓名关键词
- `status`：处理状态（可选）
- `missingRequired`：`true|false`（可选）
- `from/to`：提交时间范围（ISO，可选）
- `departmentId`：部门（可选）
- `page/pageSize`

### 4.9 批量处理：POST `/api/console/materials/:id/submissions/batch`
**权限**：`campus:material:process`

### 4.10 导出 ZIP：GET `/api/console/materials/:id/export`
**权限**：`campus:material:export`  
**查询参数**
- 与提交列表一致：`q/status/missingRequired/from/to/departmentId`
- `includeUnsubmitted`：`true|false`（默认 `false`；默认仅导出 `submittedAt != null`）
**说明**：返回 `application/zip` 附件下载。

### 4.11 删除任务（软删）：DELETE `/api/console/materials/:id`
**权限**：`campus:material:delete`  
**查询参数（可选）**
- `reason`：删除原因（将写入审计）
**响应（200）**
```json
{ "ok": true }
```
**说明**
- 软删：写入 `deletedAt`，任务将从 Portal/Console 列表中隐藏
- 不做文件物理删除（提交撤回仍按“撤回即物理删除”口径执行）
