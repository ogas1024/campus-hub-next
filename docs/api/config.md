# 平台配置（Config）API 契约（MVP）

**状态**：🟠 待实现  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-17

## 1. 注册审核开关

### 1.1 查询：GET `/api/console/config/registration`
**权限**：`campus:config:update`  
**响应（200）**
```json
{ "requiresApproval": false }
```

### 1.2 更新：PUT `/api/console/config/registration`
**权限**：`campus:config:update`  
**请求体**
```json
{ "requiresApproval": true, "reason": "string (可选)" }
```

