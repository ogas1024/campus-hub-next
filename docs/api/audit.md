# 审计日志（Audit）API 契约（MVP）

**状态**：✅ 已实现（MVP）  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-17

> 需求来源：`docs/requirements/audit.md`（已冻结 ✅）

## 1. 查询（Console）

### 1.1 列表：GET `/api/console/audit-logs`
**权限**：`campus:audit:list`  
**查询参数**
- `page`：number，默认 1
- `pageSize`：number，默认 20，最大 50
- `q`：string，可选（action/targetId/actorEmail）
- `action`：string，可选
- `targetType`：string，可选
- `targetId`：string，可选
- `actorUserId`：uuid，可选
- `success`：boolean，可选
- `from` / `to`：ISO 时间，可选

**响应（200）**
```json
{
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "items": [
    {
      "id": "uuid",
      "occurredAt": "2025-12-17T00:00:00Z",
      "actorUserId": "uuid",
      "actorEmail": "admin@example.com",
      "action": "user.ban",
      "targetType": "user",
      "targetId": "uuid",
      "success": true
    }
  ]
}
```

### 1.2 详情：GET `/api/console/audit-logs/:id`
**权限**：`campus:audit:list`
