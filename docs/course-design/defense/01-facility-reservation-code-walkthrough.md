# 功能房预约代码导读

数据库结构主入口：`packages/db/final-ddl/course-design-final-schema.sql`。历史迁移只用于说明演进过程。

功能房预约是最可能被老师深挖的模块，因为它同时涉及：

- 关系模式设计
- 时间区间冲突
- 事务和并发
- 跨行、跨表约束
- 状态机一致性
- 索引和查询优化

## 1. 这个模块解决哪些数据库问题

业务需求可以拆成 5 个数据库事实：

| 事实 | 表 | 说明 |
|---|---|---|
| 楼房 | `facility_buildings` | 空间上层实体 |
| 房间 | `facility_rooms` | 具体可预约资源 |
| 预约 | `facility_reservations` | 时间资源占用事实 |
| 参与人 | `facility_reservation_participants` | 预约和用户的多对多联系 |
| 封禁 | `facility_bans` | 模块治理记录 |

老师问“怎么设计”的时候，不要先讲操作流程，先讲这些事实为什么要分表。

## 2. 表结构核心代码

位置：`packages/db/final-ddl/course-design-final-schema.sql:749-959`

```sql
create table if not exists public.facility_rooms (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.facility_buildings(id) on delete restrict,
  floor_no integer not null,
  name text not null,
  capacity integer null,
  ...
  constraint facility_rooms_capacity_chk check (capacity is null or capacity >= 0)
);

create unique index if not exists facility_rooms_name_active_uq
  on public.facility_rooms(building_id, floor_no, name)
  where deleted_at is null;
```

答辩口径：

- 房间依附楼房，用外键保证参照完整性。
- 房间名不是全局唯一，而是在 `(building_id, floor_no, name)` 范围内唯一。
- 唯一索引只作用于 `deleted_at is null`，所以软删除历史不会阻止重新创建同名有效房间。

预约主体：

```sql
create table if not exists public.facility_reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.facility_rooms(id) on delete restrict,
  applicant_id uuid not null references auth.users(id) on delete restrict,
  purpose text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.facility_reservation_status not null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  reject_reason text null,
  cancelled_by uuid null references auth.users(id) on delete set null,
  cancelled_at timestamptz null,
  cancel_reason text null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint facility_reservations_time_chk check (end_at > start_at)
);
```

答辩口径：

- 预约只存 `room_id`，不重复存房间名、楼房名，避免更新异常。
- 申请人、审核人、取消人、创建人都引用用户，但删除策略不同：
  - `applicant_id/created_by` 用 `RESTRICT`，避免历史主体被破坏。
  - `reviewed_by/cancelled_by/updated_by` 用 `SET NULL`，保留预约事实。

参与人：

```sql
create table if not exists public.facility_reservation_participants (
  reservation_id uuid not null references public.facility_reservations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  is_applicant boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (reservation_id, user_id)
);

create unique index if not exists facility_reservation_participants_applicant_uq
  on public.facility_reservation_participants(reservation_id)
  where is_applicant;
```

答辩口径：

- 预约和用户是多对多，所以不能把参与人存成字符串列表。
- `(reservation_id, user_id)` 复合主键防止同一用户在同一预约中重复出现。
- 部分唯一索引保证每条预约最多一个 `is_applicant=true`。

## 3. 时间冲突：最关键的答辩点

服务层先做时间重叠预查。

位置：`lib/modules/facilities/facilities.service.ts:360-370`

```ts
async function assertNoTimeOverlap(params: { tx: DbTx; roomId: string; startAt: Date; endAt: Date; excludeReservationId?: string }) {
  const where = [
    eq(facilityReservations.roomId, params.roomId),
    inArray(facilityReservations.status, ["pending", "approved"]),
    sql`${facilityReservations.startAt} < ${params.endAt.toISOString()}`,
    sql`${facilityReservations.endAt} > ${params.startAt.toISOString()}`,
  ];
  if (params.excludeReservationId) where.push(sql`${facilityReservations.id} <> ${params.excludeReservationId}`);

  const rows = await params.tx.select({ id: facilityReservations.id }).from(facilityReservations).where(and(...where)).limit(1);
  if (rows[0]) throw conflict("时间段冲突，请查看时间轴并调整");
}
```

答辩口径：

- 两个区间重叠条件是：已有开始 `<` 新结束，并且已有结束 `>` 新开始。
- 只检查 `pending/approved`，因为待审核也预占资源；驳回和取消不占用资源。

数据库最终兜底：

位置：`packages/db/final-ddl/course-design-final-schema.sql:811-906`

```sql
create extension if not exists btree_gist with schema public;

alter table public.facility_reservations
  add constraint facility_reservations_room_active_time_excl
  exclude using gist (
    room_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status in ('pending', 'approved'));
```

答辩口径：

- 这是 PostgreSQL 排斥约束，表达“同一房间的活跃预约时间段不得重叠”。
- `[)` 半开区间允许 10:00-11:00 和 11:00-12:00 连续预约。
- 即使两个事务同时提交，数据库仍能拒绝最终冲突写入。

## 4. 创建预约事务

位置：`lib/modules/facilities/facilities.service.ts:407-445`

```ts
const inserted = await db.transaction(async (tx) => {
  await lockRoomOrThrow(tx, params.roomId);
  await assertNoTimeOverlap({ tx, roomId: params.roomId, startAt, endAt });

  const rows = await tx
    .insert(facilityReservations)
    .values({
      roomId: params.roomId,
      applicantId: params.userId,
      purpose: params.purpose.trim(),
      startAt,
      endAt,
      status,
      reviewedBy: status === "approved" ? params.userId : null,
      reviewedAt: status === "approved" ? now : null,
      createdBy: params.userId,
    })
    .returning({ id: facilityReservations.id });

  const reservationId = rows[0]!.id;

  await tx.insert(facilityReservationParticipants).values(
    participants.map((userId) => ({
      reservationId,
      userId,
      isApplicant: userId === params.userId,
    })),
  );

  return reservationId;
});
```

事务里做了四件事：

1. `FOR UPDATE` 锁定房间行。
2. 查询同房间时间冲突。
3. 插入预约主表。
4. 插入参与人明细。

房间锁代码：

位置：`lib/modules/facilities/facilities.service.ts:346-355`

```ts
const res = await tx.execute(
  sql`select ${facilityRooms.id} from ${facilityRooms}
    inner join ${facilityBuildings} on ${facilityBuildings.id} = ${facilityRooms.buildingId}
    where ${facilityRooms.id} = ${roomId}
      and ${facilityRooms.enabled} = true
      and ${facilityRooms.deletedAt} is null
      and ${facilityBuildings.enabled} = true
      and ${facilityBuildings.deletedAt} is null
    for update`,
);
```

答辩口径：

- 行锁让同一房间的预约创建尽量串行化。
- 但真正的不变量仍由排斥约束保证，不能只靠服务层查询。

## 5. 参与人一致性

服务层先规范化参与人：

位置：`lib/modules/facilities/facilities.service.ts:335-343`

```ts
function normalizeParticipantUserIds(params: { applicantId: string; participantUserIds: string[] }) {
  const normalized = params.participantUserIds.map((id) => id.trim()).filter(Boolean);
  if (normalized.some((id) => id === params.applicantId)) {
    throw badRequest("participantUserIds 不允许包含申请人");
  }

  const unique = [...new Set([params.applicantId, ...normalized])];
  if (unique.length < 3) throw badRequest("使用人列表不少于 3 人（含申请人）");
  return unique;
}
```

数据库层再兜底：

位置：`packages/db/final-ddl/course-design-final-schema.sql:966-1047`

```sql
select
  count(*)::integer,
  (count(*) filter (where p.is_applicant))::integer,
  (count(*) filter (where p.is_applicant and p.user_id = v_applicant_id))::integer
  into v_participant_count, v_applicant_marked_count, v_applicant_match_count
from public.facility_reservation_participants p
where p.reservation_id = v_reservation_id;

if v_participant_count < 3 then
  raise exception using
    errcode = '23514',
    constraint = 'facility_reservation_participants_min_count_chk';
end if;

if v_applicant_marked_count <> 1 then
  raise exception using
    errcode = '23514',
    constraint = 'facility_reservation_participants_applicant_count_chk';
end if;

if v_applicant_match_count <> 1 then
  raise exception using
    errcode = '23514',
    constraint = 'facility_reservation_participants_applicant_match_chk';
end if;
```

触发器声明：

位置：`packages/db/final-ddl/course-design-final-schema.sql:1055-1066`

```sql
create constraint trigger facility_reservations_participant_consistency_trg
after insert or update of applicant_id on public.facility_reservations
deferrable initially deferred
for each row execute function public.facility_validate_reservation_participants();

create constraint trigger facility_reservation_participants_consistency_trg
after insert or update or delete on public.facility_reservation_participants
deferrable initially deferred
for each row execute function public.facility_validate_reservation_participants();
```

答辩口径：

- 普通 `CHECK` 做不了，因为它只能检查当前行。
- 这里需要统计一条预约下多行参与人，还要和预约主表的 `applicant_id` 比较，所以用触发器。
- 触发器延迟到事务提交，是为了允许“先插主表、后插参与人”的正常中间状态。

## 6. 状态一致性

位置：`packages/db/final-ddl/course-design-final-schema.sql:833-895`

```sql
add constraint facility_reservations_status_consistency_chk check (
  (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and reject_reason is null
    and cancelled_by is null
    and cancelled_at is null
    and cancel_reason is null
  )
  or
  (
    status = 'approved'
    and reviewed_by is not null
    and reviewed_at is not null
    and reject_reason is null
    and cancelled_by is null
    and cancelled_at is null
    and cancel_reason is null
  )
  ...
);
```

服务层审核通过：

位置：`lib/modules/facilities/facilities.service.ts:1242-1246`

```ts
const updated = await db
  .update(facilityReservations)
  .set({
    status: "approved",
    reviewedBy: params.actorUserId,
    reviewedAt: sql`now()`,
    rejectReason: null,
    updatedAt: sql`now()`,
    updatedBy: params.actorUserId,
  })
  .where(and(eq(facilityReservations.id, params.reservationId), eq(facilityReservations.status, "pending")))
  .returning({ id: facilityReservations.id });
```

答辩口径：

- 服务层只允许 `pending -> approved/rejected`。
- 数据库层防止手工构造“状态已通过但没有审核时间”这类脏数据。

## 7. 被驳回预约重新提交

位置：`lib/modules/facilities/facilities.service.ts:500-547`

```ts
await db.transaction(async (tx) => {
  const rows = await tx
    .select({
      id: facilityReservations.id,
      roomId: facilityReservations.roomId,
      applicantId: facilityReservations.applicantId,
      status: facilityReservations.status,
    })
    .from(facilityReservations)
    .where(eq(facilityReservations.id, params.reservationId))
    .limit(1);

  const row = rows[0];
  if (row.status !== "rejected") throw conflict("仅允许修改被驳回的预约");

  await lockRoomOrThrow(tx, row.roomId);
  await assertNoTimeOverlap({ tx, roomId: row.roomId, startAt, endAt, excludeReservationId: row.id });

  await tx.update(facilityReservations).set({ ... }).where(eq(facilityReservations.id, row.id));

  await tx.delete(facilityReservationParticipants).where(eq(facilityReservationParticipants.reservationId, row.id));
  await tx.insert(facilityReservationParticipants).values(...);
});
```

答辩口径：

- 主表和参与人列表必须原子更新。
- 删除旧参与人、插入新参与人的过程会产生临时中间态，所以仍依赖延迟触发器在提交时检查最终合法性。

## 8. 封禁设计

位置：`packages/db/final-ddl/course-design-final-schema.sql:943-959`

```sql
create table if not exists public.facility_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  reason text null,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  revoked_reason text null,
  created_by uuid not null references auth.users(id) on delete restrict,
  revoked_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint facility_bans_revoked_chk check (revoked_at is null or revoked_at >= created_at)
);

create unique index if not exists facility_bans_user_active_uq
  on public.facility_bans(user_id)
  where revoked_at is null;
```

创建预约前检查：

位置：`lib/modules/facilities/facilities.service.ts:128-139`

```ts
async function assertNotBanned(userId: string) {
  const rows = await db
    .select({ id: facilityBans.id, expiresAt: facilityBans.expiresAt })
    .from(facilityBans)
    .where(and(eq(facilityBans.userId, userId), isNull(facilityBans.revokedAt)))
    .orderBy(desc(facilityBans.createdAt), desc(facilityBans.id))
    .limit(1);

  const row = rows[0];
  if (!row) return;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return;
  throw forbidden("你已被功能房预约模块封禁，无法提交预约");
}
```

封禁替换事务：

位置：`lib/modules/facilities/facilities.service.ts:1396-1407`

```ts
await db.transaction(async (tx) => {
  await tx.update(facilityBans)
    .set({ revokedAt: sql`now()`, revokedBy: params.actorUserId, revokedReason: "被新封禁覆盖" })
    .where(and(eq(facilityBans.userId, params.userId), isNull(facilityBans.revokedAt)));

  await tx.insert(facilityBans).values({
    userId: params.userId,
    reason,
    expiresAt,
    revokedAt: null,
    createdBy: params.actorUserId,
  });
});
```

边界说明：

- 当前唯一索引按 `revoked_at is null` 判断活动封禁。
- 服务层允许自然过期封禁用户继续预约。
- 但自然过期而未撤销的记录仍会占用唯一索引位置。
- 这是答辩中可以主动说明的真实边界。

## 9. 这个模块的范式答法

可以这样回答：

- `facility_buildings`、`facility_rooms`、`facility_reservations` 主体上满足 3NF。
- 没有把楼房名、房间名重复存入预约表，所以避免了传递依赖和更新异常。
- `facility_reservation_participants` 是多对多联系表，复合主键 `(reservation_id,user_id)`，接近 BCNF。
- `facility_bans` 是封禁事实表，不把封禁状态塞进用户表，避免用户主数据承担历史记录职责。
