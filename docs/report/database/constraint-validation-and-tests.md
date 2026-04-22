# 校园生活平台约束验证与测试说明

## 1. 编写目的

数据库课程设计的测试不应只写“页面能用”，而应重点证明：

- 关系模式是否正确
- 主键、外键、唯一约束、检查约束是否有效
- 触发器是否真正起作用
- 典型异常场景能否被数据库或事务正确拦截
- 哪些规则已经数据库化，哪些规则属于服务层协同或设计取舍

本文件即为这一目标服务。

说明：

- 文中的 `:xxx` 为测试占位参数
- 除明确用于验证外键失败的场景外，其他参数默认应替换为数据库中真实存在的合法标识

## 2. 测试分类

本项目当前主线模块的约束验证建议按四类组织：

1. 结构完整性测试
2. 参照完整性测试
3. 用户定义完整性测试
4. 事务一致性与异常场景测试

## 2.1 2026-04-21 至 2026-04-22 Supabase 实库验证记录

本轮已在 Supabase 新建空项目 `campus-hub-next` 中完成一次真实数据库验证，而不只是停留在“设计上的可验证”。

本次实际执行的迁移：

- `0001_baseline`
- `0002_infra`
- `0003_department_parent_fk`
- `0004_course_resources`
- `0005_course_resources_constraints`
- `0006_facility_reservations`
- `0012_course_design_constraints`
- `0013_course_resource_author_and_best_constraints`
- `0014_facility_reservation_status_consistency`
- `0015_module_dictionary_and_data_scope_fks`
- `0016_audit_actor_snapshot_strategy`

本次为验证专门插入的最小测试数据包括：

- 3 个 `auth.users` 测试账号，并确认 `profiles.status='active'`
- 1 栋测试楼房 `DBVALID_BUILDING`
- 1 个测试房间 `DBVALID_ROOM_101`
- 2 个测试专业 `DBVALID_MAJOR_A` / `DBVALID_MAJOR_B`
- 1 门测试课程 `DBVALID_COURSE_DB`
- 1 条测试课程资源草稿 `DBVALID_RESOURCE_DRAFT`
- 1 个临时角色 `db_test_role_0015`

已实际验证通过的新增数据库约束：

- `facility_reservations_room_active_time_excl`
  - 结果：`PASS: 时间冲突已被数据库拒绝`
- `facility_reservation_participants_min_count_chk`
  - 结果：`PASS: 参与人数下限已生效`
- `facility_reservation_participants_applicant_match_chk`
  - 结果：`PASS: 申请人与参与人一致性约束已生效`
- `course_resources_course_major_fk`
  - 结果：`PASS: course_resources 复合外键已生效`
- `course_resource_score_events_resource_major_fk`
  - 结果：`PASS: score_event 复合外键已生效`
- `course_resources_status_consistency_chk`
  - 结果：`PASS: 资源状态一致性 CHECK 已生效`
- `course_resource_bests_best_by_fk`
  - 结果：`PASS: best_by 外键已生效`
- `course_resource_score_events_resource_user_fk`
  - 结果：`PASS: 积分事件作者归属复合外键已生效`
- `course_resource_bests_resource_published_chk`
  - 结果：`PASS: 未发布资源不能设为最佳`
- `course_resources_drop_best_on_status_change_trg`
  - 结果：`PASS: 已发布资源下架后，最佳推荐记录会被自动撤销`
- `facility_reservations_status_consistency_chk`
  - 结果：`PASS: pending/approved/rejected/cancelled 的审核/取消字段组合已生效`
- `role_data_scopes_module_fk`
  - 结果：`PASS: role_data_scopes.module 只能引用 data_scope_modules 中已登记的模块`
- `data_scope_modules_module_code_fk`
  - 结果：`PASS: data_scope_modules 只能引用 app_modules 中真实存在的模块`
- `audit_logs_actor_roles_object_chk`
  - 结果：`PASS: actor_roles 非法 JSON 结构会被数据库拒绝`
- `audit_logs.actor_user_id` 弱引用策略
  - 结果：`PASS: 以随机 UUID 写入审计探针时，数据库未误加物理外键`

补充观察：

- 在第一次验证“房间时间冲突”时，数据库先拦截了一个非法的 `approved` 预约记录，因为其缺少 `reviewed_at`，说明旧有的 `facility_reservations_review_chk` 同样正常工作。
- `audit_logs.actor_name` 回填在当前验证库中属于“空表安全执行”验证，因为测试项目中的 `audit_logs` 本轮为空表；若答辩需要展示历史回填，可额外补造一条旧结构样本复演。
- 这说明本项目当前数据库层已经不仅能保证基础主外键完整性，还能对“业务状态机一致性”“并发冲突”“受控冗余一致性”进行直接约束。

复现实验步骤、实际可执行 SQL 与截图清单见：

- `docs/report/database/supabase-reproduction-and-screenshot-checklist.md`

## 3. 已由数据库直接保证的约束测试

### 3.1 用户资料表学号格式检查

测试 SQL：

```sql
insert into public.profiles(id, name, student_id, status)
values (:user_id, '测试用户', '20240001', 'active');
```

预期结果：

- 插入失败
- 原因是 `profiles_student_id_format_chk`
- 说明 `student_id` 必须满足 16 位数字格式

### 3.2 角色编码唯一性

测试 SQL：

```sql
insert into public.roles(code, name)
values ('admin', '重复管理员');
```

预期结果：

- 插入失败
- 原因是唯一索引 `roles_code_uq`

### 3.3 部门父节点必须真实存在

测试 SQL：

```sql
insert into public.departments(name, parent_id)
values ('非法部门', '00000000-0000-0000-0000-000000000001');
```

预期结果：

- 插入或更新失败
- 原因是自引用外键 `departments_parent_id_fk`

### 3.4 部门层级不能形成环

测试步骤：

1. 已存在部门 `A -> B`
2. 执行把 `A.parent_id = B.id`

测试 SQL：

```sql
update public.departments
set parent_id = :child_department_id
where id = :ancestor_department_id;
```

预期结果：

- 更新失败
- 触发器函数 `departments_assert_no_cycle()` 抛出异常

### 3.5 自定义数据范围子表不能脱离父表存在

测试 SQL：

```sql
insert into public.role_data_scope_departments(role_id, module, department_id)
values (:role_id, 'resource', :department_id);
```

前提：

- `role_data_scopes` 中并不存在 `(role_id, 'resource')`

预期结果：

- 插入失败
- 原因是复合外键 `role_data_scope_departments_fk`

### 3.6 审计日志为只追加表

测试 SQL：

```sql
update public.audit_logs
set action = 'tampered'
where id = :audit_log_id;
```

```sql
delete from public.audit_logs
where id = :audit_log_id;
```

预期结果：

- `UPDATE` 和 `DELETE` 均失败
- 触发器 `audit_logs_block_update` / `audit_logs_block_delete` 生效

### 3.7 同楼房同楼层房间名唯一

测试 SQL：

```sql
insert into public.facility_rooms(building_id, floor_no, name)
values (:building_id, 3, 'A301');
```

前提：

- 同一 `building_id`、同一 `floor_no` 下已有未删除房间 `A301`

预期结果：

- 插入失败
- 原因是部分唯一索引 `facility_rooms_name_active_uq`

### 3.8 预约时间必须满足结束晚于开始

测试 SQL：

```sql
insert into public.facility_reservations(
  room_id, applicant_id, purpose, start_at, end_at, status, created_by
)
values (
  :room_id, :user_id, '非法预约',
  '2026-05-01 10:00:00+08',
  '2026-05-01 09:00:00+08',
  'pending',
  :user_id
);
```

预期结果：

- 插入失败
- 原因是 `facility_reservations_time_chk`

### 3.9 每条预约最多只能有一个申请人标记

测试 SQL：

```sql
insert into public.facility_reservation_participants(reservation_id, user_id, is_applicant)
values
  (:reservation_id, :user_a, true),
  (:reservation_id, :user_b, true);
```

预期结果：

- 第二条插入失败
- 原因是部分唯一索引 `facility_reservation_participants_applicant_uq`

### 3.10 同一用户同时最多一条未撤销封禁

测试 SQL：

```sql
insert into public.facility_bans(user_id, created_by)
values (:target_user_id, :actor_user_id);
```

前提：

- 该用户已存在 `revoked_at is null` 的封禁记录

预期结果：

- 插入失败
- 原因是部分唯一索引 `facility_bans_user_active_uq`

### 3.11 课程资源文件/外链字段组合检查

测试 SQL：

```sql
insert into public.course_resources(
  major_id, course_id, title, description, resource_type, status,
  link_url, created_by
)
values (
  :major_id, :course_id, '非法资源', '缺少规范化链接',
  'link', 'pending',
  'https://example.com',
  :user_id
);
```

预期结果：

- 插入失败
- 原因是 `course_resources_file_or_link_chk`

### 3.12 同课程下文件资源哈希去重

测试 SQL：

```sql
insert into public.course_resources(
  major_id, course_id, title, description, resource_type, status,
  file_bucket, file_key, file_name, file_size, sha256, created_by
)
values (
  :major_id, :course_id, '重复文件', '测试',
  'file', 'published',
  'course-resources', 'demo/a.pdf', 'a.pdf', 1024, :sha256, :user_id
);
```

前提：

- 同一课程已存在未删除、相同 `sha256` 的文件资源

预期结果：

- 插入失败
- 原因是部分唯一索引 `course_resources_course_sha256_active_uq`

### 3.13 同课程下外链规范化 URL 去重

测试 SQL：

```sql
insert into public.course_resources(
  major_id, course_id, title, description, resource_type, status,
  link_url, link_url_normalized, created_by
)
values (
  :major_id, :course_id, '重复外链', '测试',
  'link', 'published',
  'https://example.com?a=1',
  'https://example.com?a=1',
  :user_id
);
```

预期结果：

- 插入失败
- 原因是部分唯一索引 `course_resources_course_link_active_uq`

### 3.14 积分事件增量必须大于 0，且同类首次事件唯一

测试 SQL 1：

```sql
insert into public.course_resource_score_events(
  user_id, major_id, resource_id, event_type, delta
)
values (:user_id, :major_id, :resource_id, 'approve', 0);
```

预期结果：

- 插入失败
- 原因是 `course_resource_score_events_delta_chk`

测试 SQL 2：

```sql
insert into public.course_resource_score_events(
  user_id, major_id, resource_id, event_type, delta
)
values (:user_id, :major_id, :resource_id, 'approve', 5);
```

前提：

- 同一 `(user_id, resource_id, event_type)` 已存在

预期结果：

- 插入失败或在应用中被 `on conflict do nothing` 吸收
- 数据库层唯一约束 `course_resource_score_events_first_uq` 负责兜底

## 4. 已落库规则总表

为了让课程设计报告更像数据库课程的材料，而不是单纯的工程实现说明，建议先把“哪些规则已经真正落到数据库层”单独列清楚。

| 规则/主题 | 当前主要保障层 | 当前情况 | 课程设计表达建议 |
|----------|----------------|----------|------------------|
| 学号格式 | 数据库 | `CHECK` 已落库 | 直接作为用户定义完整性示例 |
| 角色编码唯一 | 数据库 | 唯一索引已落库 | 作为候选键与唯一性示例 |
| 部门树防环 | 数据库 | 触发器已落库 | 作为层级结构建模亮点 |
| 模块字典与数据权限模块域约束 | 数据库 | `app_modules` / `data_scope_modules` / `role_data_scopes.module` 外键已落库 | 作为领域完整性与可扩展字典设计示例 |
| 数据范围父子一致性 | 数据库 | 复合外键已落库 | 作为复合外键亮点 |
| 审计日志 append-only 与快照结构 | 数据库 | 触发器、`actor_name`、`actor_roles` 结构检查均已落库 | 作为审计历史表亮点 |
| 房间名范围唯一 | 数据库 | 部分唯一索引已落库 | 作为“业务唯一性 + 软删除”示例 |
| 预约时间先后合法 | 数据库 | `CHECK` 已落库 | 作为状态前置合法性示例 |
| 预约状态与审核/取消字段一致 | 数据库 | `CHECK` 已落库 | 作为状态一致性示例 |
| 预约时间冲突 | 数据库 + 事务 | `facility_reservations_room_active_time_excl` 已落库，服务层事务继续协同 | 作为并发控制与数据库硬约束协同示例 |
| 每预约最多一个申请人标记 | 数据库 | 部分唯一索引已落库 | 作为跨表一致性约束的组成部分 |
| 预约至少 3 名参与人 | 数据库 | 延迟约束触发器已落库 | 作为聚合约束数据库化示例 |
| 预约申请人与参与人一致 | 数据库 | 延迟约束触发器已落库 | 作为跨表一致性数据库化示例 |
| 有效封禁唯一 | 数据库 | 部分唯一索引已落库 | 需额外说明“自然过期但未撤销”的边界 |
| 文件资源与外链资源互斥 | 数据库 | `CHECK` 已落库 | 作为课程资源模块代表性约束 |
| 课程资源状态与时间字段一致 | 数据库 | `course_resources_status_consistency_chk` 已落库 | 作为资源状态机一致性示例 |
| 同课程资源去重 | 数据库 | 部分唯一索引已落库 | 作为数据库自己拒绝重复数据的例子 |
| 课程资源 `major_id` 一致性 | 数据库 | `course_resources_course_major_fk` 已落库 | 作为受控冗余一致性示例 |
| `course_resource_bests.best_by` 引用关系 | 数据库 | 物理外键已落库 | 作为推荐关系完整性示例 |
| 最佳推荐仅作用于已发布资源 | 数据库 | 触发器已落库，且下架时自动撤销 | 作为派生状态约束示例 |
| 积分事件专业维度一致性 | 数据库 | `course_resource_score_events_resource_major_fk` 已落库 | 作为受控冗余一致性示例 |
| 积分事件作者归属一致性 | 数据库 | `course_resource_score_events_resource_user_fk` 已落库 | 作为复合外键控制作者归属示例 |
| 积分首次语义 | 数据库 | 唯一约束已落库 | 作为幂等与事实表建模示例 |
| 审计日志 `actor_user_id` 物理外键 | 设计取舍 | 当前故意不建 FK，保留弱引用 | 应解释为“历史真实性优先”的正式方案，而不是未完成项 |

## 5. 当前仍需说明的服务层协同与设计取舍

从课程设计角度，除了展示“已经做到的”，也应该明确指出“哪些地方是数据库硬约束 + 服务层协同”，以及“哪些地方是有意保留的设计取舍”。当前最值得说明的几项如下。

### 5.1 审计日志 `actor_user_id` 保留弱引用

当前状态：

- 数据库保存了 `actor_user_id`
- 但故意不建立到 `auth.users` 的物理外键
- 同时补了 `actor_name`、`actor_email`、`actor_roles` 快照与数据库注释

建议写法：

- 这不是“还没来得及加 FK”，而是“历史审计真实性优先”的正式口径
- 答辩时应强调：数据库已经对快照结构做了检查，但不让用户主数据的后续变化破坏既有审计事实

### 5.2 `facility_bans` 的“自然过期但未撤销”语义

当前状态：

- 当前唯一索引使用 `revoked_at is null` 判定“活动封禁”
- 若封禁已自然过期但未显式撤销，仍会占用唯一索引位置

建议写法：

- 这是真实剩余边界，可以如实保留
- 不必写成“系统有问题”，而应写成“当前语义选择与后续可优化点”

### 5.3 服务层事务与数据库硬约束的协同

当前状态：

- 创建预约、重提预约、设置最佳等操作仍由服务层开启事务并做前置校验
- 但房间时间冲突、发布态最佳、作者归属、参与人一致性等关键规则已由数据库对象兜底

建议写法：

- 服务层负责流程编排、友好报错、审计记录
- 数据库负责最终拒绝非法状态，二者是协同关系而不是替代关系

### 5.4 课程资源中的受控冗余

当前状态：

- `course_resources.major_id` 与 `course_resource_score_events.major_id/user_id` 都属于受控冗余
- 当前已经由复合唯一键与复合外键锁定一致性

建议写法：

- 强调“必要冗余 + 数据库锁定一致性”是本轮优化后的正式设计
- 不要再写成“主要依赖服务层”

## 6. 事务一致性与异常场景测试建议

除单条约束测试外，报告中还应至少写出以下事务级测试：

### 6.1 同时提交相交预约

预期：

- 在同一房间、相交时间段下，至少一个请求会被拒绝
- 服务层可能先返回业务友好提示；即便绕过服务层，数据库仍会被 `facility_reservations_room_active_time_excl` 拒绝

### 6.2 构造非法参与人集合后提交事务

预期：

- 若参与人数少于 3，事务在提交时会被 `facility_reservation_participants_min_count_chk` 拒绝
- 若申请人标记缺失或与 `applicant_id` 不一致，事务也会在提交时被延迟约束触发器拒绝

### 6.3 对未发布资源设为最佳，或把最佳资源改为非发布态

预期：

- 对未发布资源插入 `course_resource_bests` 时，会被 `course_resource_bests_resource_published_chk` 拒绝
- 已发布资源一旦改为非 `published` 状态，其最佳推荐记录会被触发器自动删除

### 6.4 手工写入错误作者归属的积分事件

预期：

- 若 `course_resource_score_events.user_id` 不等于资源作者，数据库会被 `course_resource_score_events_resource_user_fk` 拒绝
- 若 `major_id` 不等于资源所属专业，则会被 `course_resource_score_events_resource_major_fk` 拒绝

## 7. 报告撰写建议

在正式报告中，测试部分建议不要只写“功能测试通过”，而应写成下面这种结构：

1. 列出被验证的数据库约束类型
2. 给出 1 到 2 条代表性失败 SQL
3. 说明数据库返回的错误含义
4. 区分“数据库硬约束”“服务层协同”“设计取舍”
5. 对真实剩余边界给出解释，而不是把已完成规则继续写成“尚未落库”

这样写更符合数据库课程设计的评分逻辑，也更容易让老师看到你真正关注的是数据建模与完整性。
