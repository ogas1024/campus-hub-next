# 问卷模块 API 契约（MVP）

**状态**：✅ 已实现（MVP）  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-19

> 需求来源：`docs/requirements/surveys.md`（已冻结 ✅）

## 1. 通用约定

### 1.1 认证与权限

- Portal：仅要求登录（`requireUser`），不强制权限码。
- Console：需要权限码；并包含“资源级授权/数据范围”约束（默认仅操作自己创建的问卷；admin/super_admin 全量）。

### 1.2 状态与有效状态

- `draft`：草稿（可编辑结构）
- `published`：已发布（结构锁定）
- `closed`：已结束（不可提交，可查看本人答卷）

有效状态口径：
- 若 `now >= endAt`，视为 `closed`（即使 DB 状态仍为 `published`）。

### 1.3 可见范围（OR 逻辑）

- `visibleAll=true`：全员可见
- `visibleAll=false`：至少 1 条 scope；用户命中 role / department / position 任一即可见
  - `department` 的命中口径为“部门及子部门”（由组织闭包表支撑）

### 1.4 题型

- `text`：文本
- `single`：单选
- `multi`：多选
- `rating`：评分（1-5）

## 2. 数据结构（DTO）

### 2.1 SurveyScope

```json
{ "scopeType": "role|department|position", "refId": "uuid" }
```

### 2.2 SurveySection / SurveyQuestion

```json
{
  "id": "uuid",
  "title": "string",
  "sort": 0,
  "questions": [
    {
      "id": "uuid",
      "sectionId": "uuid",
      "questionType": "text|single|multi|rating",
      "title": "string",
      "description": "string|null",
      "required": true,
      "sort": 0,
      "options": [
        { "id": "uuid", "label": "string", "sort": 0 }
      ]
    }
  ]
}
```

### 2.3 提交答卷（SubmitSurveyResponse）

```json
{
  "items": [
    { "questionId": "uuid", "value": { "text": "..." } },
    { "questionId": "uuid", "value": { "optionId": "uuid" } },
    { "questionId": "uuid", "value": { "optionIds": ["uuid"] } },
    { "questionId": "uuid", "value": { "value": 5 } }
  ]
}
```

## 3. Portal（/api/surveys）

### 3.1 列表：GET `/api/surveys`

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
      "phase": "upcoming|active|closed",
      "submittedAt": "2025-12-20T12:00:00Z",
      "updatedAt": "2025-12-20T12:00:00Z"
    }
  ]
}
```

### 3.2 详情：GET `/api/surveys/:id`

**认证**：需要登录  
**说明**
- 仅返回“当前用户可见”的问卷详情
- `canSubmit=true` 表示当前可提交（有效状态为 published 且在时间窗内）

**响应（200）**：包含问卷结构与我的答卷（如有）

### 3.3 提交/覆盖：POST `/api/surveys/:id/responses`

**认证**：需要登录  
**说明**
- 幂等：同一用户对同一问卷重复提交会覆盖上一份答案
- 仅当 `canSubmit=true` 时允许提交

**请求体**：见 2.3  
**响应（200）**

```json
{ "ok": true, "responseId": "uuid", "submittedAt": "2025-12-20T12:00:00Z" }
```

## 4. Console（/api/console/surveys）

> 所有 `/api/console/**` 接口默认要求具备对应权限码；同时做“数据范围/资源级授权”约束。

### 4.1 可见范围选项：GET `/api/console/surveys/scope-options`

**权限**：`campus:survey:create` 或 `campus:survey:update`  
**响应（200）**

```json
{
  "roles": [{ "id": "uuid", "name": "工作人员", "code": "staff" }],
  "departments": [{ "id": "uuid", "name": "xxx", "parentId": null }],
  "positions": [{ "id": "uuid", "name": "xxx" }]
}
```

### 4.2 列表：GET `/api/console/surveys`

**权限**：`campus:survey:list`  
**查询参数**
- `page` / `pageSize`
- `q`：标题关键词（可选）
- `status`：`draft|published|closed`（可选；`closed` 包含“到期视为结束”）
- `mine`：boolean（默认 false，仅查看我创建的）

### 4.3 创建草稿：POST `/api/console/surveys`

**权限**：`campus:survey:create`  
**请求体**：基础信息（不含结构；默认生成 1 个分节）  
**响应（201）**

```json
{ "id": "uuid" }
```

### 4.4 详情：GET `/api/console/surveys/:id`

**权限**：`campus:survey:read`  
**响应（200）**：问卷结构 + scopes

### 4.5 更新草稿（结构替换）：PUT `/api/console/surveys/:id`

**权限**：`campus:survey:update`  
**说明**：仅 `draft` 允许；以“全量替换”方式保存 sections/questions/options/scopes。

### 4.6 发布：POST `/api/console/surveys/:id/publish`

**权限**：`campus:survey:publish`  
**说明**：草稿必须至少 1 道题；单选/多选题至少 2 个选项。

### 4.7 关闭：POST `/api/console/surveys/:id/close`

**权限**：`campus:survey:close`

### 4.8 结果：GET `/api/console/surveys/:id/results`

**权限**：`campus:survey:read`  
**说明**：返回聚合后的统计结构（选择题分布、评分分布、文本样本抽样）。

### 4.9 导出 CSV：GET `/api/console/surveys/:id/export`

**权限**：`campus:survey:export`  
**说明**
- 返回 `text/csv` 附件下载（UTF-8 BOM）
- 匿名问卷不包含身份列

### 4.10 AI 总结：POST `/api/console/surveys/:id/ai-summary`

**权限**：`campus:survey:ai_summary`  
**说明**
- 仅“有效状态 closed”的问卷允许生成
- 结果不落库
- 开放题原文按样本抽样发送给 AI

**响应（200）**

```json
{ "markdown": "# TL;DR\\n..." }
```

