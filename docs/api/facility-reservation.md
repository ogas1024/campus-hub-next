# 功能房预约模块 API 契约（MVP）

**状态**：✅ 已实现  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-19

> 需求来源：`docs/requirements/facility-reservation.md`（已冻结 ✅）  
> 约定：Portal 端仅要求登录（`requireUser`）；Console 端按权限码（RBAC）控制。

## 1. 通用约定

### 1.1 认证与鉴权

- Portal：
  - 需要登录（401：`UNAUTHORIZED`）
  - 不要求权限码（403 不出现）
- Console：
  - 需要登录
  - 需要权限码（403：`FORBIDDEN`）

### 1.2 错误码

- `BAD_REQUEST`（400）：参数校验失败
- `UNAUTHORIZED`（401）：未登录
- `FORBIDDEN`（403）：无权限
- `NOT_FOUND`（404）：资源不存在或不可见
- `CONFLICT`（409）：时间段冲突/状态冲突
- `INTERNAL_ERROR`（500）：未知错误

## 2. DTO（数据结构）

### 2.1 Building

```json
{
  "id": "uuid",
  "name": "string",
  "enabled": true,
  "sort": 0,
  "remark": "string|null"
}
```

### 2.2 Room

```json
{
  "id": "uuid",
  "buildingId": "uuid",
  "floorNo": 1,
  "name": "string",
  "capacity": 20,
  "enabled": true,
  "remark": "string|null"
}
```

### 2.3 ReservationStatus

- `pending|approved|rejected|cancelled`

### 2.4 TimelineItem（公共时间轴）

> 说明：Portal 时间轴默认不返回敏感信息（目的/参与人明细等），仅用于展示占用。

```json
{
  "id": "uuid",
  "roomId": "uuid",
  "status": "pending|approved",
  "startAt": "2025-12-19T10:00:00Z",
  "endAt": "2025-12-19T12:00:00Z"
}
```

### 2.5 MyReservationListItem

```json
{
  "id": "uuid",
  "status": "pending|approved|rejected|cancelled",
  "building": { "id": "uuid", "name": "string" },
  "room": { "id": "uuid", "name": "string", "floorNo": 1 },
  "purpose": "string",
  "startAt": "2025-12-19T10:00:00Z",
  "endAt": "2025-12-19T12:00:00Z",
  "participantCount": 3,
  "rejectReason": "string|null",
  "createdAt": "2025-12-01T10:00:00Z"
}
```

### 2.6 Leaderboard（窗口聚合）

```json
{
  "days": 30,
  "items": [
    {
      "id": "uuid",
      "label": "string",
      "totalSeconds": 3600
    }
  ]
}
```

## 3. Portal（/api/facilities/**）

### 3.1 楼房列表：GET `/api/facilities/buildings`

**认证**：登录  
**响应（200）**：`Building[]`（仅返回 `enabled=true`）

### 3.2 楼层列表：GET `/api/facilities/floors?buildingId=<uuid>`

**认证**：登录  
**响应（200）**

```json
{ "buildingId": "uuid", "floors": [1, 0, -1] }
```

### 3.3 楼层纵览（甘特图数据）：GET `/api/facilities/floors/overview?buildingId=<uuid>&floorNo=<int>&from=<iso>&days=7|30`

**认证**：登录  
**响应（200）**

```json
{
  "buildingId": "uuid",
  "floorNo": 1,
  "window": { "from": "2025-12-19T00:00:00Z", "to": "2025-12-26T00:00:00Z" },
  "rooms": [/* Room[] */],
  "items": [/* TimelineItem[] */]
}
```

### 3.4 房间时间轴：GET `/api/facilities/rooms/:id/timeline?from=<iso>&days=7|30`

**认证**：登录  
**响应（200）**：`{ room: Room, window, items: TimelineItem[] }`

### 3.5 房间时长榜：GET `/api/facilities/leaderboard/rooms?days=7|30`

**认证**：登录  
**响应（200）**：Leaderboard（房间维度）

### 3.6 用户时长榜：GET `/api/facilities/leaderboard/users?days=7|30`

**认证**：登录  
**响应（200）**：Leaderboard（申请人维度）

## 4. Portal（/api/me/reservations/**）

### 4.1 我的预约列表：GET `/api/me/reservations?page=&pageSize=&status=&from=&to=`

**认证**：登录  
**响应（200）**：分页 `MyReservationListItem[]`

### 4.2 创建预约：POST `/api/me/reservations`

**认证**：登录  
**请求体（示例）**

```json
{
  "roomId": "uuid",
  "startAt": "2025-12-19T10:00:00Z",
  "endAt": "2025-12-19T12:00:00Z",
  "purpose": "小组讨论",
  "participantUserIds": ["uuid", "uuid"]
}
```

**说明**
- `participantUserIds` 不包含申请人；服务端会自动加入申请人并校验最小人数。
- 审核开关=关闭：返回 `approved`；开启：返回 `pending`。

### 4.3 修改并重提：PATCH `/api/me/reservations/:id`

**认证**：登录  
**规则**：仅允许 `rejected` 状态修改（起止时间/目的/参与人），并按审核开关重新进入 `pending/approved`。

### 4.4 取消：POST `/api/me/reservations/:id/cancel`

**认证**：登录  
**规则**：`pending/approved` 且开始时间未到；否则 `CONFLICT`。

## 5. Portal（用户搜索）

### 5.1 参与人搜索：GET `/api/users/search?q=<string>&limit=<n?>`

**认证**：登录  
**响应（200）**

```json
{
  "items": [
    { "id": "uuid", "name": "张三", "studentId": "2025..." }
  ]
}
```

## 6. Console（/api/console/facilities/**）

### 6.1 楼房管理：CRUD `/api/console/facilities/buildings`

**权限**：`campus:facility:*`

### 6.2 房间管理：CRUD `/api/console/facilities/rooms`

**权限**：`campus:facility:*`

### 6.3 预约审核：GET `/api/console/facilities/reservations?status=pending&...`

**权限**：`campus:facility:review` 或 `campus:facility:*`

### 6.4 通过/驳回：POST `/api/console/facilities/reservations/:id/approve|reject`

**权限**：同上；`reject` 需必填 `reason`

### 6.5 模块配置：GET/PUT `/api/console/facilities/config`

**权限**：`campus:facility:config` 或 `campus:facility:*`

### 6.6 封禁：GET/POST `/api/console/facilities/bans`、POST `/api/console/facilities/bans/:id/revoke`

**权限**：`campus:facility:ban` 或 `campus:facility:*`
