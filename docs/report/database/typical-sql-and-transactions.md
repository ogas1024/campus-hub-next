# 校园生活平台典型 SQL 与事务并发控制说明

## 1. 编写目的

本文件用于支撑课程设计报告中的“典型 SQL 与事务设计”章节，目标不是罗列所有语句，而是展示当前数据库设计最能体现学习成果的几类查询与事务：

- 树结构查询
- 数据范围过滤
- 审计时间线查询
- 时间区间冲突判断
- 排行榜统计
- 审核与积分写入的一致性事务

下面给出的 SQL 为报告级写法，与当前实现逻辑保持一致，可直接作为正式报告材料引用。

说明：

- 文中的 `:xxx` 为占位参数
- 除明确用于测试外键失败的场景外，这些参数默认应替换为数据库中真实存在的合法标识

## 2. 典型查询 SQL

### 2.1 查询某部门及其全部子部门

平台基础模块采用闭包表后，可以避免层层递归查找。

```sql
select d.id, d.name, dc.depth
from public.department_closure dc
join public.departments d
  on d.id = dc.descendant_id
where dc.ancestor_id = :department_id
order by dc.depth asc, d.name asc;
```

说明：

- `depth = 0` 表示部门自身
- `depth > 0` 表示各层子部门
- 该查询直接受益于 `department_closure_ancestor_id_idx`

### 2.2 计算某角色在某模块的自定义数据范围

```sql
select rs.role_id, rs.module, rs.scope_type, rd.department_id
from public.role_data_scopes rs
join public.data_scope_modules dm
  on dm.module_code = rs.module
left join public.role_data_scope_departments rd
  on rd.role_id = rs.role_id
 and rd.module = rs.module
where rs.role_id = :role_id
  and rs.module = :module
order by rd.department_id asc;
```

说明：

- `(role_id, module)` 是父记录
- `data_scope_modules` 保证这里的 `module` 一定来自“支持数据权限”的模块集合
- `role_data_scope_departments` 中的部门列表表示 `custom` 范围展开前的原始配置
- 复合外键保证不会出现“有子表、无父表”的脏数据

### 2.3 根据数据范围过滤“当前操作者可见的用户”

当前实现中，部门范围最终映射到 `user_departments` 上：

```sql
select p.id, p.name, p.student_id
from public.profiles p
where p.id in (
  select ud.user_id
  from public.user_departments ud
  where ud.department_id in (
    select dc.descendant_id
    from public.department_closure dc
    where dc.ancestor_id = :actor_department_id
  )
)
order by p.name asc, p.student_id asc;
```

说明：

- 当范围类型为 `dept_and_child` 时，需要借助 `department_closure` 展开子树
- 当范围类型为 `custom` 时，可把 `:actor_department_id` 换成自定义部门集合
- 这一设计说明数据权限过滤不是凭空写判断，而是建立在明确关系模式之上的

### 2.4 审计日志多条件时间线查询

```sql
select id,
       occurred_at,
       actor_user_id,
       actor_name,
       actor_email,
       action,
       target_type,
       target_id,
       success
from public.audit_logs
where (:action is null or action = :action)
  and (:target_type is null or target_type = :target_type)
  and (:actor_user_id is null or actor_user_id = :actor_user_id)
  and (:from_time is null or occurred_at >= :from_time)
  and (:to_time is null or occurred_at <= :to_time)
order by occurred_at desc, id desc
limit :page_size offset :offset;
```

说明：

- 排序使用 `occurred_at desc, id desc`
- 这种时间线查询直接受益于时间索引、动作索引和目标对象复合索引
- 审计表的意义不是事务更新，而是持续追加和追溯

### 2.5 查询某房间在给定时间窗口内的占用情况

```sql
select r.id,
       r.room_id,
       r.status,
       r.start_at,
       r.end_at
from public.facility_reservations r
where r.room_id = :room_id
  and r.status in ('pending', 'approved')
  and r.start_at < :window_end
  and r.end_at > :window_start
order by r.start_at asc, r.id asc;
```

说明：

- 这里使用了标准的时间区间重叠判断：
  - `existing.start < new.end`
  - `existing.end > new.start`
- `facility_reservations_room_active_time_idx` 就是为这一类查询准备的部分索引

### 2.6 统计功能房使用时长排行榜

```sql
select rm.id,
       b.name as building_name,
       rm.floor_no,
       rm.name as room_name,
       sum(
         greatest(
           0,
           extract(
             epoch from least(r.end_at, :window_end) - greatest(r.start_at, :window_start)
           )
         )
       ) as total_seconds
from public.facility_reservations r
join public.facility_rooms rm
  on rm.id = r.room_id
join public.facility_buildings b
  on b.id = rm.building_id
where r.status = 'approved'
  and r.start_at < :window_end
  and r.end_at > :window_start
  and rm.deleted_at is null
  and b.deleted_at is null
group by rm.id, b.name, rm.floor_no, rm.name
order by total_seconds desc
limit 50;
```

说明：

- 这里不是简单 `count(*)`，而是统计与时间窗口实际重叠的秒数
- 这一点能体现数据库对复杂业务统计的建模能力

### 2.7 课程资源下载榜

```sql
select e.resource_id,
       count(*) as window_download_count
from public.course_resource_download_events e
join public.course_resources r
  on r.id = e.resource_id
where r.deleted_at is null
  and r.status = 'published'
  and e.occurred_at >= :from_time
group by e.resource_id
order by count(*) desc, e.resource_id desc
limit 50;
```

说明：

- 榜单统计依赖事实表，而不是只看资源表中的累计字段
- 这是“事务型主表 + 事件事实表”组合建模的典型例子

### 2.8 课程资源积分榜

```sql
select s.user_id,
       p.name,
       sum(s.delta) as score,
       sum(case when s.event_type = 'approve' then 1 else 0 end) as approve_count,
       sum(case when s.event_type = 'best' then 1 else 0 end) as best_count
from public.course_resource_score_events s
join public.profiles p
  on p.id = s.user_id
where (:major_id is null or s.major_id = :major_id)
group by s.user_id, p.name
order by sum(s.delta) desc, p.name asc
limit 20;
```

说明：

- 积分榜并不是实时扫描所有资源状态推导，而是从积分事实表直接聚合
- `(user_id, resource_id, event_type)` 唯一约束保证了“首次语义”不会被重复累计

## 3. 典型事务设计

### 3.1 角色数据范围整体替换事务

当前“配置某角色全部数据范围”的实现不是零散更新，而是一次事务完成“删旧 + 插新”：

```sql
begin;

delete from public.role_data_scope_departments
where role_id = :role_id;

delete from public.role_data_scopes
where role_id = :role_id;

insert into public.role_data_scopes(role_id, module, scope_type)
values
  (:role_id, 'user', 'dept_and_child'),
  (:role_id, 'notice', 'custom');

insert into public.role_data_scope_departments(role_id, module, department_id)
values
  (:role_id, 'notice', :dept_a),
  (:role_id, 'notice', :dept_b);

commit;
```

设计原因：

- 避免只更新一半时产生中间不一致状态
- `role_data_scope_departments` 必须依赖 `role_data_scopes` 存在
- `role_data_scopes.module` 还会被 `role_data_scopes_module_fk` 兜底校验，防止写入未登记到能力表的模块

### 3.2 功能房预约创建事务

当前预约创建的关键步骤是：

```sql
begin;

select r.id
from public.facility_rooms r
join public.facility_buildings b
  on b.id = r.building_id
where r.id = :room_id
  and r.enabled = true
  and r.deleted_at is null
  and b.enabled = true
  and b.deleted_at is null
for update;

select 1
from public.facility_reservations fr
where fr.room_id = :room_id
  and fr.status in ('pending', 'approved')
  and fr.start_at < :new_end
  and fr.end_at > :new_start
limit 1;

insert into public.facility_reservations(...);
insert into public.facility_reservation_participants(...);

commit;
```

设计原因：

- 先锁房间行，缩小并发竞争范围
- 再判断有效预约时间段是否重叠
- 最后一次性写入预约主体与参与人
- 即便两个并发事务都走到了插入阶段，数据库仍会由 `facility_reservations_room_active_time_excl` 拒绝最终冲突写入

当前评价：

- 这是一个较规范的事务并发控制方案
- 它现在已经是“事务前置判断 + 数据库排斥约束”协同模式
- 服务层负责用户体验，数据库负责最终硬保护

### 3.3 被驳回预约重新提交事务

被驳回预约重新提交时，当前实现仍使用事务：

```sql
begin;

select id, room_id, applicant_id, status
from public.facility_reservations
where id = :reservation_id;

select 1
from public.facility_reservations
where room_id = :room_id
  and status in ('pending', 'approved')
  and start_at < :new_end
  and end_at > :new_start
  and id <> :reservation_id
limit 1;

update public.facility_reservations
set purpose = :purpose,
    start_at = :new_start,
    end_at = :new_end,
    status = :next_status,
    reviewed_by = null,
    reviewed_at = null,
    reject_reason = null,
    cancelled_by = null,
    cancelled_at = null;

delete from public.facility_reservation_participants
where reservation_id = :reservation_id;

insert into public.facility_reservation_participants(...);

commit;
```

设计原因：

- 保证预约主记录与参与人列表同步更新
- 避免参与人已经改了、预约主体却没改成功的情况
- 当前实现会锁定房间行并检查时间冲突，事务提交时还会由延迟约束触发器再次校验参与人集合是否合法

### 3.4 功能房封禁替换事务

```sql
begin;

update public.facility_bans
set revoked_at = now(),
    revoked_by = :actor_user_id,
    revoked_reason = '被新封禁覆盖'
where user_id = :target_user_id
  and revoked_at is null;

insert into public.facility_bans(user_id, reason, expires_at, created_by)
values (:target_user_id, :reason, :expires_at, :actor_user_id);

commit;
```

设计原因：

- 同一用户同时只能存在一条未撤销封禁
- 事务可以保证“旧封禁失效”和“新封禁生效”原子完成
- `facility_bans_user_active_uq` 部分唯一索引作为数据库层的第二道保护

### 3.5 课程资源审核通过与积分写入事务

```sql
begin;

update public.course_resources
set status = 'published',
    reviewed_by = :reviewer_id,
    reviewed_at = now(),
    review_comment = :comment,
    published_at = now(),
    unpublished_at = null,
    updated_by = :reviewer_id
where id = :resource_id
  and status = 'pending';

insert into public.course_resource_score_events
  (user_id, major_id, resource_id, event_type, delta)
values
  (:author_id, :major_id, :resource_id, 'approve', :delta)
on conflict do nothing;

commit;
```

设计原因：

- 审核通过与首次积分应视为一个业务原子单元
- `on conflict do nothing` 与唯一约束配合，保证重复审核或重放请求不会重复加分
- 如果 `:author_id` 或 `:major_id` 与资源主体不一致，数据库会被复合外键直接拒绝

### 3.6 最佳推荐与额外积分事务

```sql
begin;

insert into public.course_resource_bests(resource_id, best_by, best_at)
values (:resource_id, :actor_user_id, now())
on conflict (resource_id) do update
set best_by = excluded.best_by,
    best_at = now();

insert into public.course_resource_score_events
  (user_id, major_id, resource_id, event_type, delta)
values
  (:author_id, :major_id, :resource_id, 'best', :delta)
on conflict do nothing;

commit;
```

设计原因：

- “设为最佳”与“写入最佳积分事件”必须保持一致
- 主键 `resource_id` 保证同一资源最多一个最佳记录
- 唯一约束保证“最佳积分”只记一次
- `course_resource_bests_best_by_fk` 与 `course_resource_bests_resource_published_chk` 共同保证推荐人引用有效、且只有已发布资源才能被设为最佳

## 4. 并发控制分析

### 4.1 当前最典型的并发场景

本项目当前最有代表性的并发场景有三类：

1. 两个用户同时提交同一房间相交时间段的预约
2. 管理员同时修改同一角色的数据范围配置
3. 资源审核或设为最佳操作被重复点击或重放

### 4.2 目前已采用的控制方式

| 场景 | 当前控制方式 | 数据库配合点 |
|------|--------------|--------------|
| 功能房预约冲突 | 事务 + `FOR UPDATE` + 重叠查询 | 部分索引加速判断，`EXCLUDE` 约束拒绝最终冲突写入 |
| 角色数据范围修改 | 整体替换事务 | 复合外键防止父子失配 |
| 封禁替换 | 事务 + 部分唯一索引 | 保证同时最多一条有效封禁 |
| 审核加分 | 事务 + 唯一约束 + `on conflict do nothing` | 防止重复积分 |
| 最佳推荐加分 | 事务 + 主键/唯一约束 + `on conflict` | 防止重复最佳记录与重复积分，并由触发器保证仅限已发布资源 |

### 4.3 当前应强调的协同与取舍

经过本轮增强后，功能房时间冲突、课程资源状态一致性、最佳推荐发布态约束、积分作者归属一致性都已经下沉到数据库层。

因此这里更准确的表达应当是：

- 服务层事务负责前置校验、流程编排、错误翻译与审计记录
- 数据库约束负责最终拒绝非法写入
- 二者是协同关系，而不是“主要靠服务层兜底”

当前仍值得在这一章主动说明的两点是：

1. `audit_logs.actor_user_id` 保留弱引用，是为了保护历史审计事实，而不是漏建外键
2. `facility_bans` 的“自然过期但未显式撤销”语义，仍是一个真实存在的边界

## 5. 结论

从课程设计视角看，这一部分最值得展示的不是“SQL 写得多复杂”，而是：

- SQL 是围绕明确的关系模式与索引设计出来的
- 事务边界与业务原子单元是一一对应的
- 并发控制不是事后补丁，而是从表结构、索引、约束到事务流程整体协同完成的
- 当前最值得展示的是“事务 + 数据库硬约束”双层保护已经形成闭环

因此在正式报告中，建议把“典型 SQL”和“事务设计”一起讲，效果会明显好于分开孤立描述。
