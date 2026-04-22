# 投票模块 API 契约（MVP）

**状态**：✅ 已实现（方案 2A）  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-21

> 需求来源：`docs/requirements/votes.md`（已冻结 ✅）

## 1. 通用约定

### 1.1 认证与权限

- Portal：需要登录（`requireUser`），不强制权限码。
- Console：需要权限码；并包含“数据范围/资源级授权”约束（默认仅操作自己创建的数据；admin/super_admin 可全量）。

### 1.2 状态与有效状态

- `draft`：草稿（可编辑结构）
- `published`：已发布（结构锁定）
- `closed`：已结束（不可提交，可看结果）

有效状态口径：
- 若 `status=closed`，有效状态为 `closed`。
- 若 `status=published` 且 `now >= endAt`，有效状态视为 `closed`。

### 1.3 可见范围（OR 逻辑）

- `visibleAll=true`：全员可见
- `visibleAll=false`：至少 1 条 scope；用户命中 role / department / position 任一即可见
  - `department` 命中口径为“部门及子部门”

### 1.4 题型

- `single`：单选
- `multi`：多选（包含 `maxChoices`）

## 2. 数据结构（DTO）

### 2.1 VoteScope

```json
{ "scopeType": "role|department|position", "refId": "uuid" }
```

### 2.2 VoteQuestion / VoteOption

```json
{
  "id": "uuid",
  "questionType": "single|multi",
  "title": "string",
  "description": "string|null",
  "required": true,
  "sort": 0,
  "maxChoices": 2,
  "options": [
    { "id": "uuid", "label": "string", "sort": 0 }
  ]
}
```

### 2.3 提交投票（SubmitVoteResponse）

```json
{
  "items": [
    { "questionId": "uuid", "value": { "optionId": "uuid" } },
    { "questionId": "uuid", "value": { "optionIds": ["uuid"] } }
  ]
}
```

## 3. Portal（/api/votes）

### 3.1 列表：GET `/api/votes`

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
  "total": 123,
  "items": [
    {
      "id": "uuid",
      "title": "string",
      "status": "published|closed",
      "effectiveStatus": "published|closed",
      "startAt": "2025-12-19T00:00:00Z",
      "endAt": "2025-12-26T00:00:00Z",
      "anonymousResponses": false,
      "pinned": false,
      "phase": "upcoming|active|closed",
      "submittedAt": "2025-12-20T12:00:00Z",
      "updatedAt": "2025-12-20T12:00:00Z"
    }
  ]
}
```

### 3.2 我的投票：GET `/api/votes/my`

**认证**：需要登录  
**说明**：仅返回“我已投过”的投票（包含已归档）

### 3.3 详情：GET `/api/votes/:id`

**认证**：需要登录  
**说明**
- 仅返回“当前用户可见/我已投过/我创建”的投票详情
- `canSubmit=true` 表示当前可提交
- `results` 仅在投票结束或归档后返回

**响应（200）**：包含投票结构、我的答卷（如有）与结果（如可见）

### 3.4 提交/覆盖：POST `/api/votes/:id/responses`

**认证**：需要登录  
**说明**
- 幂等：同一用户对同一投票重复提交会覆盖上一份答案
- 仅当 `canSubmit=true` 时允许提交

**请求体**：见 2.3  
**响应（200）**

```json
{ "ok": true, "responseId": "uuid", "submittedAt": "2025-12-20T12:00:00Z" }
```

## 4. Console（/api/console/votes）

### 4.1 可见范围选项：GET `/api/console/votes/scope-options`

**权限**：`campus:vote:create` 或 `campus:vote:update`  
**响应（200）**

```json
{
  "roles": [{ "id": "uuid", "name": "工作人员", "code": "staff" }],
  "departments": [{ "id": "uuid", "name": "xxx", "parentId": null }],
  "positions": [{ "id": "uuid", "name": "xxx" }]
}
```

### 4.2 列表：GET `/api/console/votes`

**权限**：`campus:vote:list`  
**查询参数**
- `page` / `pageSize`
- `q`：标题关键词（可选）
- `status`：`draft|published|closed`（可选；`closed` 包含“到期视为结束”）
- `mine`：boolean（默认 false）
- `archived`：boolean（默认 false）

### 4.3 创建草稿：POST `/api/console/votes`

**权限**：`campus:vote:create`  
**说明**：创建投票草稿 + 默认 1 道题与 2 个候选项  
**响应（201）**

```json
{ "id": "uuid" }
```

### 4.4 详情：GET `/api/console/votes/:id`

**权限**：`campus:vote:read`  
**响应（200）**：投票结构 + scopes

### 4.5 更新草稿（结构替换）：PUT `/api/console/votes/:id`

**权限**：`campus:vote:update`  
**说明**：仅 `draft` 允许；以“全量替换”方式保存 questions/options/scopes。

### 4.6 发布：POST `/api/console/votes/:id/publish`

**权限**：`campus:vote:publish`  
**说明**：草稿至少 1 道题；每题至少 2 个候选项；`multi` 需满足 `1 <= maxChoices <= optionsCount`。

### 4.7 关闭：POST `/api/console/votes/:id/close`

**权限**：`campus:vote:close`

### 4.8 延期：POST `/api/console/votes/:id/extend`

**权限**：`campus:vote:extend`  
**请求体**

```json
{ "endAt": "2025-12-31T00:00:00Z" }
```

**说明**：允许到期后延期；`endAt` 只能变大；若当前 `status=closed` 会重新开放为 `published`。

### 4.9 置顶：POST `/api/console/votes/:id/pin`

**权限**：`campus:vote:pin`  
**请求体**

```json
{ "pinned": true }
```

**说明**：仅未结束且已发布允许置顶；结束后自动取消。

### 4.10 归档：POST `/api/console/votes/:id/archive`

**权限**：`campus:vote:archive`  
**说明**：仅“有效状态 closed”的投票允许归档；归档后 Portal 公共列表隐藏。

### 4.11 结果：GET `/api/console/votes/:id/results`

**权限**：`campus:vote:read`  
**响应**：总参与人数 + 每题选项票数与占比
