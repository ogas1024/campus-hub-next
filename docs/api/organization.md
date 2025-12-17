# 组织与岗位（Organization）API 契约（MVP）

**状态**：🟠 待实现  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-17

> 需求来源：`docs/requirements/organization.md`（已冻结 ✅）

## 1. 部门（Console）

### 1.1 树查询：GET `/api/console/departments`
**权限**：`campus:department:*`  
**响应（200）**
```json
{
  "items": [
    { "id": "uuid", "name": "信息学院", "parentId": null, "sort": 0 },
    { "id": "uuid", "name": "计算机科学与技术", "parentId": "uuid", "sort": 0 }
  ]
}
```

### 1.2 创建：POST `/api/console/departments`
**权限**：`campus:department:*`  
**请求体**
```json
{ "name": "计科2023-1班", "parentId": "uuid", "sort": 10 }
```

### 1.3 更新（含移动）：PATCH `/api/console/departments/:id`
**权限**：`campus:department:*`  
**请求体**
```json
{ "name": "新名称", "parentId": "uuid|null", "sort": 0 }
```

### 1.4 删除：DELETE `/api/console/departments/:id`
**权限**：`campus:department:*`  
**约束**：存在子部门或用户绑定则返回 409（CONFLICT）

## 2. 岗位（Console）

### 2.1 列表：GET `/api/console/positions`
**权限**：`campus:position:*`

### 2.2 创建：POST `/api/console/positions`
**权限**：`campus:position:*`  
**请求体**
```json
{ "code": "librarian", "name": "图书管理员", "description": "...", "enabled": true, "sort": 0 }
```

### 2.3 更新：PATCH `/api/console/positions/:id`
**权限**：`campus:position:*`

### 2.4 删除（自动解绑）：DELETE `/api/console/positions/:id`
**权限**：`campus:position:*`

## 3. 用户组织分配（Console）

### 3.1 用户部门：PUT `/api/console/users/:id/departments`
**权限**：`campus:user:assign_org`

### 3.2 用户岗位：PUT `/api/console/users/:id/positions`
**权限**：`campus:user:assign_org`

