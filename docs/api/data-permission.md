# 数据范围与数据权限（Data Permission）API 契约（MVP）

**状态**：✅ 已实现（MVP）  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-17

> 需求来源：`docs/requirements/data-permission.md`（已冻结 ✅）

## 1. 约定
- `module` 必须与权限码 `campus:<module>:<op>` 的 `module` 段一致。
- `scopeType` 取值：`ALL|CUSTOM|DEPT|DEPT_AND_CHILD|SELF|NONE`

## 2. 角色数据范围（Console）

### 2.1 查询：GET `/api/console/roles/:id/data-scopes`
**权限**：`campus:role:*`  
**响应（200）**
```json
{
  "roleId": "uuid",
  "items": [
    { "module": "notice", "scopeType": "ALL", "departmentIds": [] },
    { "module": "user", "scopeType": "CUSTOM", "departmentIds": ["uuid"] }
  ]
}
```

### 2.2 设置（覆盖式）：PUT `/api/console/roles/:id/data-scopes`
**权限**：`campus:role:*`  
**请求体**
```json
{
  "items": [
    { "module": "notice", "scopeType": "ALL" },
    { "module": "user", "scopeType": "CUSTOM", "departmentIds": ["uuid"] }
  ]
}
```

**响应（200）**：返回 2.1 的结构
