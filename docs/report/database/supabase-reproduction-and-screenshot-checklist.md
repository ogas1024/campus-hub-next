# Supabase 复现实验步骤与截图清单

## 1. 目的

本文用于把“数据库课程设计增强”部分做成可重复、可截图、可答辩的实验证据，重点覆盖：

- 迁移执行顺序
- 结构约束是否真正落库
- 最小测试数据如何构造
- 关键数据库约束如何逐条验证
- 实验结束后如何清理测试数据
- 报告需要保留哪些截图

## 2. 适用范围

本文对应的数据库主线模块为：

- 基础设施基线
- 课程资源分享
- 功能房预约
- 本轮新增的 `0012_course_design_constraints.sql`

推荐在一个新的、空的 Supabase 项目中执行，或者在确认不存在同名测试数据的测试环境中执行。

## 3. 迁移执行步骤

在 Supabase Dashboard 中打开 `SQL Editor`，按以下顺序依次执行：

1. `packages/db/migrations/0001_baseline.sql`
2. `packages/db/migrations/0002_infra.sql`
3. `packages/db/migrations/0003_department_parent_fk.sql`
4. `packages/db/migrations/0004_course_resources.sql`
5. `packages/db/migrations/0005_course_resources_constraints.sql`
6. `packages/db/migrations/0006_facility_reservations.sql`
7. `packages/db/migrations/0012_course_design_constraints.sql`

说明：

- 本轮数据库验证不依赖 `0007` 到 `0011`
- 每个文件单独执行一次，不要把多个 migration 拼成一个大 SQL 运行

## 4. 结构核验 SQL

执行完迁移后，先确认关键约束与触发器已经进入数据库。

### 4.1 约束核验

```sql
select conname, contype
from pg_constraint
where conname in (
  'facility_reservations_room_active_time_excl',
  'courses_id_major_id_uq',
  'course_resources_id_major_id_uq',
  'course_resources_course_major_fk',
  'course_resource_score_events_resource_major_fk',
  'course_resource_bests_best_by_fk',
  'course_resources_status_consistency_chk'
)
order by conname;
```

预期：

- 共返回 7 条
- 其中 `contype='x'` 表示排斥约束
- `contype='u'` 表示唯一约束
- `contype='f'` 表示外键
- `contype='c'` 表示检查约束

### 4.2 触发器核验

```sql
select tgname
from pg_trigger
where tgname in (
  'facility_reservation_participants_consistency_trg',
  'facility_reservations_participant_consistency_trg'
)
order by tgname;
```

预期：

- 返回 2 条

## 5. 最小测试数据构造

### 5.1 插入 3 个测试用户

```sql
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  is_sso_user,
  is_anonymous
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'dbv1@example.com',
    crypt('Passw0rd!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"DBV User 1","studentId":"2026000000000001"}'::jsonb,
    now(),
    now(),
    '', '', '', '', false, false
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'dbv2@example.com',
    crypt('Passw0rd!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"DBV User 2","studentId":"2026000000000002"}'::jsonb,
    now(),
    now(),
    '', '', '', '', false, false
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'dbv3@example.com',
    crypt('Passw0rd!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"DBV User 3","studentId":"2026000000000003"}'::jsonb,
    now(),
    now(),
    '', '', '', '', false, false
  )
on conflict (id) do nothing;

select u.id, u.email, p.status, p.student_id
from auth.users u
left join public.profiles p on p.id = u.id
where u.email in ('dbv1@example.com', 'dbv2@example.com', 'dbv3@example.com')
order by u.email;
```

预期：

- 3 个用户插入成功
- `profiles` 通过触发器自动生成
- `profiles.status='active'`

### 5.2 插入业务测试数据

```sql
insert into public.facility_buildings (name, enabled, sort)
values ('DBVALID_BUILDING', true, 0)
on conflict do nothing;

insert into public.facility_rooms (building_id, floor_no, name, enabled, sort)
select b.id, 1, 'DBVALID_ROOM_101', true, 0
from public.facility_buildings b
where b.name = 'DBVALID_BUILDING'
  and b.deleted_at is null
  and not exists (
    select 1 from public.facility_rooms r
    where r.building_id = b.id
      and r.floor_no = 1
      and r.name = 'DBVALID_ROOM_101'
      and r.deleted_at is null
  );

insert into public.majors (name, enabled, sort)
values
  ('DBVALID_MAJOR_A', true, 0),
  ('DBVALID_MAJOR_B', true, 1)
on conflict do nothing;

insert into public.courses (major_id, name, enabled, sort)
select m.id, 'DBVALID_COURSE_DB', true, 0
from public.majors m
where m.name = 'DBVALID_MAJOR_A'
  and m.deleted_at is null
  and not exists (
    select 1 from public.courses c
    where c.major_id = m.id
      and c.name = 'DBVALID_COURSE_DB'
      and c.deleted_at is null
  );

insert into public.course_resources (
  major_id,
  course_id,
  title,
  description,
  resource_type,
  status,
  created_by,
  updated_by
)
select
  m.id,
  c.id,
  'DBVALID_RESOURCE_DRAFT',
  'db validation seed',
  'link',
  'draft',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111'
from public.majors m
join public.courses c on c.major_id = m.id
where m.name = 'DBVALID_MAJOR_A'
  and m.deleted_at is null
  and c.name = 'DBVALID_COURSE_DB'
  and c.deleted_at is null
  and not exists (
    select 1 from public.course_resources cr
    where cr.course_id = c.id
      and cr.title = 'DBVALID_RESOURCE_DRAFT'
      and cr.deleted_at is null
  );

select 'facility_room' as kind, r.id::text as id, r.name as label
from public.facility_rooms r
join public.facility_buildings b on b.id = r.building_id
where b.name = 'DBVALID_BUILDING' and r.name = 'DBVALID_ROOM_101' and r.deleted_at is null and b.deleted_at is null
union all
select 'major', m.id::text, m.name
from public.majors m
where m.name in ('DBVALID_MAJOR_A', 'DBVALID_MAJOR_B') and m.deleted_at is null
union all
select 'course', c.id::text, c.name
from public.courses c
where c.name = 'DBVALID_COURSE_DB' and c.deleted_at is null
union all
select 'resource', cr.id::text, cr.title
from public.course_resources cr
where cr.title = 'DBVALID_RESOURCE_DRAFT' and cr.deleted_at is null
order by kind, label;
```

## 6. 核心约束验证 SQL

说明：

- 以下验证 SQL 都使用 `begin ... rollback`
- 因此它们不会留下脏数据
- 真正会持久保留的只有第 5 节构造的最小测试数据

### 6.1 功能房时间冲突

```sql
begin;
create temporary table _result_a(msg text);

do $$
declare
  v_room_id uuid;
  v_r1 uuid;
begin
  select fr.id into v_room_id
  from public.facility_rooms fr
  join public.facility_buildings fb on fb.id = fr.building_id
  where fb.name = 'DBVALID_BUILDING'
    and fr.name = 'DBVALID_ROOM_101'
    and fr.deleted_at is null
    and fb.deleted_at is null
  limit 1;

  insert into public.facility_reservations (
    room_id, applicant_id, purpose, start_at, end_at, status, created_by
  ) values (
    v_room_id,
    '11111111-1111-4111-8111-111111111111',
    'DB验证-冲突-1',
    now() + interval '14 day',
    now() + interval '14 day 2 hour',
    'pending',
    '11111111-1111-4111-8111-111111111111'
  )
  returning id into v_r1;

  insert into public.facility_reservation_participants (reservation_id, user_id, is_applicant) values
    (v_r1, '11111111-1111-4111-8111-111111111111', true),
    (v_r1, '22222222-2222-4222-8222-222222222222', false),
    (v_r1, '33333333-3333-4333-8333-333333333333', false);

  begin
    insert into public.facility_reservations (
      room_id, applicant_id, purpose, start_at, end_at, status, created_by
    ) values (
      v_room_id,
      '11111111-1111-4111-8111-111111111111',
      'DB验证-冲突-2',
      now() + interval '14 day 1 hour',
      now() + interval '14 day 3 hour',
      'pending',
      '11111111-1111-4111-8111-111111111111'
    );

    insert into _result_a values ('FAIL: 时间冲突没有被拦截');
  exception
    when exclusion_violation then
      insert into _result_a values ('PASS: 时间冲突已被数据库拒绝');
  end;
end $$;

select * from _result_a;
rollback;
```

### 6.2 功能房参与人数下限

```sql
begin;
create temporary table _result_b(msg text);

do $$
declare
  v_room_id uuid;
  v_r uuid;
begin
  select fr.id into v_room_id
  from public.facility_rooms fr
  join public.facility_buildings fb on fb.id = fr.building_id
  where fb.name = 'DBVALID_BUILDING'
    and fr.name = 'DBVALID_ROOM_101'
    and fr.deleted_at is null
    and fb.deleted_at is null
  limit 1;

  insert into public.facility_reservations (
    room_id, applicant_id, purpose, start_at, end_at, status, created_by
  ) values (
    v_room_id,
    '11111111-1111-4111-8111-111111111111',
    'DB验证-人数下限',
    now() + interval '15 day',
    now() + interval '15 day 2 hour',
    'pending',
    '11111111-1111-4111-8111-111111111111'
  )
  returning id into v_r;

  insert into public.facility_reservation_participants (reservation_id, user_id, is_applicant) values
    (v_r, '11111111-1111-4111-8111-111111111111', true),
    (v_r, '22222222-2222-4222-8222-222222222222', false);

  begin
    set constraints all immediate;
    insert into _result_b values ('FAIL: 少于 3 人没有被拦截');
  exception
    when check_violation then
      insert into _result_b values ('PASS: 参与人数下限已生效');
  end;
end $$;

select * from _result_b;
rollback;
```

### 6.3 功能房申请人与参与人一致性

```sql
begin;
create temporary table _result_c(msg text);

do $$
declare
  v_room_id uuid;
  v_r uuid;
begin
  select fr.id into v_room_id
  from public.facility_rooms fr
  join public.facility_buildings fb on fb.id = fr.building_id
  where fb.name = 'DBVALID_BUILDING'
    and fr.name = 'DBVALID_ROOM_101'
    and fr.deleted_at is null
    and fb.deleted_at is null
  limit 1;

  insert into public.facility_reservations (
    room_id, applicant_id, purpose, start_at, end_at, status, created_by
  ) values (
    v_room_id,
    '11111111-1111-4111-8111-111111111111',
    'DB验证-申请人一致性',
    now() + interval '16 day',
    now() + interval '16 day 2 hour',
    'pending',
    '11111111-1111-4111-8111-111111111111'
  )
  returning id into v_r;

  insert into public.facility_reservation_participants (reservation_id, user_id, is_applicant) values
    (v_r, '11111111-1111-4111-8111-111111111111', false),
    (v_r, '22222222-2222-4222-8222-222222222222', true),
    (v_r, '33333333-3333-4333-8333-333333333333', false);

  begin
    set constraints all immediate;
    insert into _result_c values ('FAIL: applicant_id 不一致没有被拦截');
  exception
    when check_violation then
      insert into _result_c values ('PASS: 申请人与参与人一致性约束已生效');
  end;
end $$;

select * from _result_c;
rollback;
```

### 6.4 `course_resources.major_id` 与 `course_id` 一致性

```sql
begin;
create temporary table _result_d(msg text);

do $$
declare
  v_major_b uuid;
  v_course_id uuid;
begin
  select id into v_major_b
  from public.majors
  where name = 'DBVALID_MAJOR_B'
    and deleted_at is null
  limit 1;

  select c.id into v_course_id
  from public.courses c
  join public.majors m on m.id = c.major_id
  where c.name = 'DBVALID_COURSE_DB'
    and m.name = 'DBVALID_MAJOR_A'
    and c.deleted_at is null
    and m.deleted_at is null
  limit 1;

  begin
    insert into public.course_resources (
      major_id, course_id, title, description, resource_type, status, created_by, updated_by
    ) values (
      v_major_b,
      v_course_id,
      'DB验证-major不一致',
      'test',
      'file',
      'draft',
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111'
    );

    insert into _result_d values ('FAIL: course_resources 的 major/course 不一致没有被拦截');
  exception
    when foreign_key_violation then
      insert into _result_d values ('PASS: course_resources 复合外键已生效');
  end;
end $$;

select * from _result_d;
rollback;
```

### 6.5 积分事件 `major_id` 与 `resource_id` 一致性

```sql
begin;
create temporary table _result_e(msg text);

do $$
declare
  v_major_b uuid;
  v_resource_id uuid;
begin
  select id into v_major_b
  from public.majors
  where name = 'DBVALID_MAJOR_B'
    and deleted_at is null
  limit 1;

  select id into v_resource_id
  from public.course_resources
  where title = 'DBVALID_RESOURCE_DRAFT'
    and deleted_at is null
  limit 1;

  begin
    insert into public.course_resource_score_events (
      user_id, major_id, resource_id, event_type, delta
    ) values (
      '22222222-2222-4222-8222-222222222222',
      v_major_b,
      v_resource_id,
      'approve',
      1
    );

    insert into _result_e values ('FAIL: score_event 的 major/resource 不一致没有被拦截');
  exception
    when foreign_key_violation then
      insert into _result_e values ('PASS: score_event 复合外键已生效');
  end;
end $$;

select * from _result_e;
rollback;
```

### 6.6 课程资源状态一致性 `CHECK`

```sql
begin;
create temporary table _result_f(msg text);

do $$
declare
  v_resource_id uuid;
begin
  select id into v_resource_id
  from public.course_resources
  where title = 'DBVALID_RESOURCE_DRAFT'
    and deleted_at is null
  limit 1;

  begin
    update public.course_resources
    set
      status = 'pending',
      submitted_at = now(),
      reviewed_by = '11111111-1111-4111-8111-111111111111',
      reviewed_at = now()
    where id = v_resource_id;

    insert into _result_f values ('FAIL: 非法状态字段组合没有被拦截');
  exception
    when check_violation then
      insert into _result_f values ('PASS: 资源状态一致性 CHECK 已生效');
  end;
end $$;

select * from _result_f;
rollback;
```

### 6.7 `course_resource_bests.best_by` 外键

```sql
begin;
create temporary table _result_g(msg text);

do $$
declare
  v_resource_id uuid;
begin
  select id into v_resource_id
  from public.course_resources
  where title = 'DBVALID_RESOURCE_DRAFT'
    and deleted_at is null
  limit 1;

  begin
    insert into public.course_resource_bests (resource_id, best_by)
    values (
      v_resource_id,
      '00000000-0000-4000-8000-000000000001'
    );

    insert into _result_g values ('FAIL: best_by 外键没有生效');
  exception
    when foreign_key_violation then
      insert into _result_g values ('PASS: best_by 外键已生效');
  end;
end $$;

select * from _result_g;
rollback;
```

## 7. 清理测试数据 SQL

全部验证结束后，执行以下 SQL 清理第 5 节构造的测试数据：

```sql
begin;

delete from public.course_resources
where title = 'DBVALID_RESOURCE_DRAFT';

delete from public.courses
where name = 'DBVALID_COURSE_DB';

delete from public.majors
where name in ('DBVALID_MAJOR_A', 'DBVALID_MAJOR_B');

delete from public.facility_rooms
where name = 'DBVALID_ROOM_101';

delete from public.facility_buildings
where name = 'DBVALID_BUILDING';

delete from auth.users
where email in ('dbv1@example.com', 'dbv2@example.com', 'dbv3@example.com');

commit;
```

清理完成后，执行：

```sql
select 'auth.users' as table_name, count(*)::int as rows from auth.users where email like 'dbv%@example.com'
union all
select 'public.profiles', count(*)::int from public.profiles where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
)
union all
select 'public.facility_buildings', count(*)::int from public.facility_buildings where name = 'DBVALID_BUILDING'
union all
select 'public.facility_rooms', count(*)::int from public.facility_rooms where name = 'DBVALID_ROOM_101'
union all
select 'public.majors', count(*)::int from public.majors where name in ('DBVALID_MAJOR_A', 'DBVALID_MAJOR_B')
union all
select 'public.courses', count(*)::int from public.courses where name = 'DBVALID_COURSE_DB'
union all
select 'public.course_resources', count(*)::int from public.course_resources where title = 'DBVALID_RESOURCE_DRAFT'
order by table_name;
```

预期：

- 所有结果都为 `0`

## 8. 截图清单

建议至少保留以下截图：

1. Supabase 项目主页
   - 能看到项目名、项目 ref、数据库状态为正常

2. `0012_course_design_constraints.sql` 执行成功截图
   - 说明本轮新增数据库增强已经实际进入数据库

3. 迁移记录截图
   - 能看到 `0001`、`0002`、`0003`、`0004`、`0005`、`0006`、`0012`

4. 约束核验结果截图
   - 7 条关键约束全部可见

5. 触发器核验结果截图
   - 2 条功能房参与人一致性触发器可见

6. 测试用户插入结果截图
   - 3 个测试用户存在，且 `profiles.status='active'`

7. 最小测试数据构造结果截图
   - 楼房、房间、专业、课程、资源都已生成

8. A 到 G 七组验证结果截图
   - 每组都应出现 `PASS: ...`

9. 清理结果截图
   - 清理后 7 张表中的测试数据计数均为 `0`

## 9. 答辩与报告表达建议

在课程设计汇报时，建议用下面的句式描述本轮成果：

- “我们不仅在文档中声明了约束，还在 Supabase 新建空库中真实执行了迁移并完成了约束验证。”
- “功能房预约的时间冲突采用 PostgreSQL 排斥约束处理，体现了数据库原生并发控制能力。”
- “课程资源中的 `major_id` 不是无意识冗余，而是受控冗余，并通过复合唯一键与复合外键保证一致性。”
- “对于参与人数下限、申请人与参与人一致性这类跨行聚合规则，我们使用了延迟约束触发器，而不是只依赖服务层判断。”
