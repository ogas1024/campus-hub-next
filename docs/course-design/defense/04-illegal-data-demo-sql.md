# 非法数据演示 SQL

这份文档用于准备答辩时的“数据库自己会拒绝非法数据”演示。实际执行时需要把 `:xxx` 占位符替换成你验证库中真实存在的 UUID。

数据库约束位置统一看：`packages/db/final-ddl/course-design-final-schema.sql`。

建议不要现场演示太多，选 2-3 个最有说服力的即可：

1. 功能房重叠预约被拒绝。
2. 功能房参与人不足或申请人不匹配被拒绝。
3. 课程资源 `course_id/major_id` 不一致被拒绝。
4. 未发布资源设为最佳被拒绝。

## 1. 预约结束时间早于开始时间

验证点：`facility_reservations_time_chk`

```sql
insert into public.facility_reservations(
  room_id,
  applicant_id,
  purpose,
  start_at,
  end_at,
  status,
  created_by
)
values (
  :room_id,
  :user_id,
  '非法时间测试',
  '2026-05-01 10:00:00+08',
  '2026-05-01 09:00:00+08',
  'pending',
  :user_id
);
```

预期：

- 插入失败。
- 数据库拒绝原因是 `facility_reservations_time_chk`。

代码位置：

- `packages/db/final-ddl/course-design-final-schema.sql:831`

## 2. 同一房间活跃预约时间段重叠

验证点：`facility_reservations_room_active_time_excl`

前提：已存在同房间 `pending` 或 `approved` 预约，例如 10:00-12:00。

```sql
insert into public.facility_reservations(
  room_id,
  applicant_id,
  purpose,
  start_at,
  end_at,
  status,
  created_by
)
values (
  :room_id,
  :another_user_id,
  '重叠预约测试',
  '2026-05-01 11:00:00+08',
  '2026-05-01 13:00:00+08',
  'pending',
  :another_user_id
);
```

预期：

- 插入失败。
- 数据库拒绝原因是 `facility_reservations_room_active_time_excl`。

代码位置：

- `packages/db/final-ddl/course-design-final-schema.sql:897-906`

答辩话术：

> 这里不是靠“查询时刚好没查到”，而是数据库把“同房间活跃时间段不重叠”定义成排斥约束，所以并发写入也会被最终拒绝。

## 3. 预约参与人少于 3 人

验证点：`facility_reservation_participants_min_count_chk`

注意：这是延迟约束触发器，建议放在事务里演示。

```sql
begin;

insert into public.facility_reservations(
  id,
  room_id,
  applicant_id,
  purpose,
  start_at,
  end_at,
  status,
  created_by
)
values (
  :reservation_id,
  :room_id,
  :user_a,
  '参与人数不足测试',
  '2026-05-02 10:00:00+08',
  '2026-05-02 11:00:00+08',
  'pending',
  :user_a
);

insert into public.facility_reservation_participants(reservation_id, user_id, is_applicant)
values
  (:reservation_id, :user_a, true),
  (:reservation_id, :user_b, false);

commit;
```

预期：

- `commit` 失败。
- 数据库拒绝原因是 `facility_reservation_participants_min_count_chk`。

代码位置：

- `packages/db/final-ddl/course-design-final-schema.sql:1017-1023`
- `packages/db/final-ddl/course-design-final-schema.sql:1055-1066`

## 4. 申请人和参与人标记不一致

验证点：`facility_reservation_participants_applicant_match_chk`

```sql
begin;

insert into public.facility_reservations(
  id,
  room_id,
  applicant_id,
  purpose,
  start_at,
  end_at,
  status,
  created_by
)
values (
  :reservation_id,
  :room_id,
  :user_a,
  '申请人不匹配测试',
  '2026-05-03 10:00:00+08',
  '2026-05-03 11:00:00+08',
  'pending',
  :user_a
);

insert into public.facility_reservation_participants(reservation_id, user_id, is_applicant)
values
  (:reservation_id, :user_a, false),
  (:reservation_id, :user_b, true),
  (:reservation_id, :user_c, false);

commit;
```

预期：

- `commit` 失败。
- 数据库拒绝原因是 `facility_reservation_participants_applicant_match_chk`。

代码位置：

- `packages/db/final-ddl/course-design-final-schema.sql:1039-1047`

## 5. 资源课程和专业不匹配

验证点：`course_resources_course_major_fk`

前提：

- `:course_id` 属于专业 A。
- `:wrong_major_id` 是专业 B。

```sql
insert into public.course_resources(
  major_id,
  course_id,
  title,
  description,
  resource_type,
  status,
  created_by
)
values (
  :wrong_major_id,
  :course_id,
  '错误专业资源',
  '测试 course_id 与 major_id 不一致',
  'file',
  'draft',
  :user_id
);
```

预期：

- 插入失败。
- 数据库拒绝原因是 `course_resources_course_major_fk`。

代码位置：

- `packages/db/final-ddl/course-design-final-schema.sql:1195-1201`

答辩话术：

> `course_resources.major_id` 是为了统计和数据范围保留的受控冗余，不是随便冗余；复合外键保证它必须等于课程真实所属专业。

## 6. 文件资源和外链字段混填

验证点：`course_resources_file_or_link_chk`

```sql
insert into public.course_resources(
  major_id,
  course_id,
  title,
  description,
  resource_type,
  status,
  file_bucket,
  file_key,
  file_name,
  file_size,
  sha256,
  link_url,
  link_url_normalized,
  created_by
)
values (
  :major_id,
  :course_id,
  '混填资源',
  '文件资源不应该带外链字段',
  'file',
  'pending',
  'course-resources',
  'demo/a.zip',
  'a.zip',
  1024,
  :sha256,
  'https://example.com',
  'https://example.com/',
  :user_id
);
```

预期：

- 插入失败。
- 数据库拒绝原因是 `course_resources_file_or_link_chk`。

代码位置：

- `packages/db/final-ddl/course-design-final-schema.sql:1203-1249`

## 7. 未发布资源设为最佳

验证点：`course_resource_bests_resource_published_chk`

前提：`:resource_id` 对应资源状态不是 `published`。

```sql
insert into public.course_resource_bests(resource_id, best_by)
values (:resource_id, :actor_user_id);
```

预期：

- 插入失败。
- 数据库触发器抛出 `course_resource_bests_resource_published_chk`。

代码位置：

- `packages/db/final-ddl/course-design-final-schema.sql:1388-1421`

## 8. 积分事件加给非作者

验证点：`course_resource_score_events_resource_user_fk`

前提：`:not_author_user_id` 不是该资源的 `created_by`。

```sql
insert into public.course_resource_score_events(
  user_id,
  major_id,
  resource_id,
  event_type,
  delta
)
values (
  :not_author_user_id,
  :major_id,
  :resource_id,
  'approve',
  5
);
```

预期：

- 插入失败。
- 数据库拒绝原因是 `course_resource_score_events_resource_user_fk`。

代码位置：

- `packages/db/final-ddl/course-design-final-schema.sql:1372-1378`

## 9. 修改或删除审计日志

验证点：审计 append-only 触发器

```sql
update public.audit_logs
set action = 'tampered'
where id = :audit_log_id;
```

```sql
delete from public.audit_logs
where id = :audit_log_id;
```

预期：

- 更新和删除都失败。
- 触发器抛出“audit_logs 为只追加表，禁止更新或删除”。

代码位置：

- `packages/db/final-ddl/course-design-final-schema.sql:444-456`
