# 校园生活平台数据库物理设计与实现说明

## 1. 编写目的

本文件用于支撑课程设计报告中的“物理设计与实现”章节，重点回答以下问题：

- 核心表为何这样落表
- 哪些约束已经下沉到数据库
- 哪些索引是为典型业务查询准备的
- 哪些触发器和数据库函数承担了完整性维护职责
- 当前方案在哪些地方已经较符合老师偏好的“学院派数据库设计”

## 2. 物理设计原则

本项目当前主线模块在物理设计上遵循以下原则：

1. 能用显式物理外键表达的关系，尽量不用纯逻辑外键代替。
2. 能由 `PRIMARY KEY`、`UNIQUE`、`CHECK`、触发器保证的数据规则，尽量不只放在应用层。
3. 对高频查询和高频冲突检测场景建立有针对性的索引，而不是只依赖主键索引。
4. 对软删除场景使用部分唯一索引，使“业务唯一性”和“历史保留”可以同时成立。
5. 对树结构、事实表、审计表等特殊结构采用专门的物理实现，而不是用单一模式硬套所有业务。

## 3. 平台基础子系统的物理设计

### 3.1 身份与资料分离

- `profiles.id` 直接引用 `auth.users.id`
- 这样把“认证身份”与“业务资料”分离开来，既保持主键一致，又使资料表可独立补充业务字段
- `profiles.student_id` 采用唯一索引和格式检查，体现了“域完整性 + 候选键”思路

### 3.2 组织树采用“自引用 + 闭包表”双层实现

`departments` 保存直接父子关系，`department_closure` 保存任意祖先到后代的可达关系。这样设计的原因是：

- `departments.parent_id` 便于表达概念结构中的直接上下级
- `department_closure` 便于高效实现“本部门及子部门”查询
- `department_closure(ancestor_id, descendant_id)` 复合主键可防止重复路径
- `depth >= 0` 的检查约束保证路径长度合法

与之配套的关键索引如下：

| 对象 | 索引/约束 | 设计目的 |
|------|-----------|----------|
| `departments` | `departments_parent_id_idx` | 加速树查询、自引用外键检查 |
| `department_closure` | 主键 `(ancestor_id, descendant_id)` | 防止重复祖先-后代关系 |
| `department_closure` | `department_closure_ancestor_id_idx` | 加速“查某部门全部后代” |
| `department_closure` | `department_closure_descendant_id_idx` | 加速“查某部门全部祖先” |

### 3.3 RBAC、模块字典与数据范围采用桥接表和复合外键

在 RBAC 相关设计中：

- `user_roles`
- `role_permissions`
- `user_departments`
- `user_positions`

都采用复合主键桥接表。这种设计的优点是：

- 不引入多余代理键
- 直接以业务标识组合表达联系
- 天然消除重复分配
- 关系模式更容易说明接近 BCNF

数据范围子模块中，最值得在答辩里强调的是：

- `app_modules` 作为系统模块主数据字典
- `data_scope_modules` 作为“支持数据权限”的模块能力表
- `role_data_scopes` 以 `(role_id, module)` 为主键
- `role_data_scopes.module` 外键引用 `data_scope_modules.module_code`
- `role_data_scope_departments` 对 `(role_id, module)` 建立复合外键

这说明“自定义部门范围”不能脱离对应的数据范围主记录单独存在，参照完整性是由数据库直接保证的。

与之配套的关键索引如下：

| 对象 | 索引/约束 | 设计目的 |
|------|-----------|----------|
| `roles` | `roles_code_uq` | 保证角色编码唯一 |
| `permissions` | `permissions_code_uq` | 保证权限编码唯一 |
| `app_modules` | `app_modules_name_uq` | 保证模块名称唯一 |
| `app_modules` | `app_modules_enabled_idx` / `app_modules_sort_idx` | 支撑模块启停过滤与排序 |
| `data_scope_modules` | `data_scope_modules_module_code_fk` | 只允许登记已存在于模块字典中的模块 |
| `role_data_scopes` | 主键 `(role_id, module)` | 保证同角色同模块只有一条数据范围记录 |
| `role_data_scopes` | `role_data_scopes_module_idx` | 支撑按模块汇总和过滤 |
| `role_data_scopes` | `role_data_scopes_module_fk` | 保证只有具备数据权限能力的模块才能配置数据范围 |
| `role_data_scope_departments` | 主键 `(role_id, module, department_id)` | 防止同部门被重复纳入同一自定义范围 |
| `role_data_scope_departments` | 复合外键 `(role_id, module)` | 强化父子表一致性 |

### 3.4 审计日志采用 append-only 物理策略

`audit_logs` 的设计重点不是普通业务查询，而是“保留历史真实性”。因此当前采用：

- 主键 `id`
- 时间索引 `audit_logs_occurred_at_idx`
- 操作者索引 `audit_logs_actor_user_id_idx`
- 动作索引 `audit_logs_action_idx`
- 目标对象复合索引 `audit_logs_target_idx`
- 触发器阻止 `UPDATE/DELETE`

这种设计体现了两个数据库课程设计要点：

1. 审计表属于历史事实表，不能像普通主数据一样被随意修改。
2. 索引是围绕“按时间线、按操作者、按对象追溯”这几类查询来设计的。

当前还应主动说明的是：

- `actor_user_id` 故意不建立物理外键
- `actor_name`、`actor_email`、`actor_roles` 被保留为快照字段
- `actor_roles` 已增加 JSON 结构检查，避免审计快照不可解释

因此，这里不应再写成“后续可选增强项”，而应写成“历史真实性优先”的正式物理设计取舍。

## 4. 功能房预约子系统的物理设计

### 4.1 空间资源实体

`facility_buildings` 与 `facility_rooms` 分层建模：

- 楼房是上层空间实体
- 房间依附于楼房，通过 `building_id` 外键建立联系
- 房间名称唯一性不是全局唯一，而是 `(building_id, floor_no, name)` 组合唯一

这比“只做全局房间名唯一”更符合真实业务，也更符合关系设计中“按识别范围建候选键”的思路。

相关索引如下：

| 对象 | 索引/约束 | 设计目的 |
|------|-----------|----------|
| `facility_buildings` | `facility_buildings_name_active_uq` | 软删除前提下保持楼房名称唯一 |
| `facility_rooms` | `facility_rooms_name_active_uq` | 同楼房同楼层下房间名唯一 |
| `facility_rooms` | `facility_rooms_building_floor_idx` | 支撑按楼房楼层列出房间 |
| `facility_rooms` | `facility_rooms_building_id_idx` | 支撑楼房下房间查询 |

### 4.2 预约主体与时间冲突相关索引/约束

`facility_reservations` 是本模块的核心业务表。当前数据库已表达的关键规则包括：

- `end_at > start_at`
- 状态与 `reviewed_by`、`reviewed_at`、`reject_reason`、`cancelled_by`、`cancelled_at` 的一致性 `CHECK`
- 同一房间 `pending/approved` 预约时间段不可重叠的 `EXCLUDE USING gist`
- `room_id`、`applicant_id`、`status` 等外键与普通索引

其中最重要的索引是：

| 对象 | 索引/约束 | 设计目的 |
|------|-----------|----------|
| `facility_reservations` | `facility_reservations_time_room_idx` | 支撑按房间和时间段查询 |
| `facility_reservations` | `facility_reservations_room_active_time_idx` | 仅对 `pending/approved` 建部分索引，加速冲突检测 |
| `facility_reservations` | `facility_reservations_room_active_time_excl` | 直接拒绝同一房间活跃预约的时间重叠写入 |

这类部分索引非常适合写进报告，因为它能说明：

- 不是所有状态都参与冲突判断
- 被驳回、已取消记录不应拖累高频冲突查询
- 物理设计是围绕业务语义展开的，而不是机械地给每个字段都加索引

### 4.3 参与人与封禁

`facility_reservation_participants` 使用：

- 复合主键 `(reservation_id, user_id)` 防止重复参与人
- 部分唯一索引 `facility_reservation_participants_applicant_uq`，保证每条预约最多一个 `is_applicant=true`
- 延迟约束触发器保证“至少 3 名参与人 + 恰有一个申请人 + 申请人必须等于 `applicant_id`”

`facility_bans` 使用：

- `facility_bans_user_active_uq` 部分唯一索引，保证同一用户同时最多只有一条未撤销封禁

这里体现的物理设计思想是：

- 对“当前有效状态”使用部分唯一索引比普通唯一索引更贴近业务
- 既能保留历史封禁记录，又能保证当前有效记录不冲突

### 4.4 当前仍需说明的边界

功能房预约本轮已经把最关键的三类规则下沉到了数据库：

- 时间段不可重叠
- 状态与审核/取消字段一致
- 申请人与参与人集合一致

服务层事务仍然保留，其作用不再是“单独兜底”，而是：

- 先做友好的业务前置判断
- 保证预约主体与参与人列表原子写入
- 在数据库拒绝时提供更可理解的错误消息

这一模块当前真正还值得保留为边界的点是：

- `facility_bans` 以 `revoked_at is null` 定义活动封禁
- “自然过期但未显式撤销”的记录仍会占用唯一索引位置

## 5. 课程资源分享子系统的物理设计

### 5.1 主数据层次

课程资源模块采用：

- `majors`
- `courses`
- `course_resources`
- `major_leads`

这样的层次结构。其物理设计重点包括：

- `majors.name` 在未删除记录中唯一
- `courses(major_id, name)` 在未删除记录中唯一
- `major_leads(major_id, user_id)` 复合主键保证负责人映射不重复

这体现了“主数据表 + 多对多桥接表”的标准关系型建模方式。

### 5.2 资源主体表的受控冗余与约束

`course_resources` 结构较丰富，是本项目最值得重点讲解的业务表之一。数据库已经保证了：

- 资源类型枚举
- 状态枚举
- 下载计数非负
- 文件资源与外链资源字段组合的 `CHECK`
- 资源状态与 `submitted_at/reviewed_at/review_comment/published_at/unpublished_at` 组合一致
- 同课程下文件按 `(course_id, sha256)` 去重
- 同课程下外链按 `(course_id, link_url_normalized)` 去重
- `(course_id, major_id) -> courses(id, major_id)` 复合外键锁定资源所属专业一致性

关键索引与约束如下：

| 对象 | 索引/约束 | 设计目的 |
|------|-----------|----------|
| `course_resources` | `course_resources_status_idx` | 审核流与列表查询 |
| `course_resources` | `course_resources_major_id_idx` | 按专业过滤 |
| `course_resources` | `course_resources_course_id_idx` | 按课程过滤 |
| `course_resources` | `course_resources_created_by_idx` | 按作者统计与作品列表 |
| `course_resources` | `course_resources_download_count_idx` | 下载榜相关排序 |
| `course_resources` | `course_resources_id_major_id_uq` | 为资源专业维度复合外键提供候选键支撑 |
| `course_resources` | `course_resources_id_created_by_uq` | 为作者归属复合外键提供候选键支撑 |
| `course_resources` | `course_resources_course_sha256_active_uq` | 同课程文件去重 |
| `course_resources` | `course_resources_course_link_active_uq` | 同课程外链去重 |

这里最适合在答辩中主动解释的点是：

- `major_id` 同时保存在 `courses` 和 `course_resources` 中，属于受控冗余
- 这样做的好处是按专业统计、按专业授权过滤更直接
- 但它要求额外保证 `course_resources.major_id` 与所属 `course.major_id` 一致

当前这一致性已经不仅由服务层保证，而是由复合外键直接锁定；服务层只负责更早给出业务友好提示。

### 5.3 事实表与榜单统计

课程资源子系统中两张事实表非常具有数据库课程设计价值：

- `course_resource_download_events`
- `course_resource_score_events`

它们不是简单冗余字段，而是面向统计和业务语义的事实记录表。

其中：

- `course_resource_download_events` 保存下载发生事实
- `course_resource_score_events` 保存积分发生事实，并用唯一约束保证“首次通过”和“首次最佳”的语义不会重复记分
- `course_resource_score_events` 还通过两组复合外键锁定“专业维度一致性”和“作者归属一致性”

相关物理设计如下：

| 对象 | 索引/约束 | 设计目的 |
|------|-----------|----------|
| `course_resource_download_events` | `course_resource_download_events_resource_id_idx` | 资源维度统计 |
| `course_resource_download_events` | `course_resource_download_events_occurred_at_idx` | 时间窗口统计 |
| `course_resource_score_events` | `course_resource_score_events_first_uq` | 保证同用户同资源同事件类型只记分一次 |
| `course_resource_score_events` | `course_resource_score_events_major_id_idx` | 按专业积分榜统计 |
| `course_resource_score_events` | `course_resource_score_events_user_id_idx` | 按用户积分榜统计 |
| `course_resource_score_events` | `course_resource_score_events_occurred_at_idx` | 时间分析与审计辅助 |
| `course_resource_score_events` | `course_resource_score_events_resource_major_fk` | 锁定积分事件与资源主体的专业维度一致性 |
| `course_resource_score_events` | `course_resource_score_events_resource_user_fk` | 锁定积分事件与资源作者的一致性 |

### 5.4 最佳推荐表

`course_resource_bests` 使用 `resource_id` 作为主键，表示“每个资源最多只有一条最佳推荐记录”。这种建模方式比在 `course_resources` 中直接放一个 `is_best` 布尔字段更适合课程设计表达，因为它：

- 把“是否最佳”从普通属性提升为独立事实
- 为后续扩展“最佳设置人、最佳时间”等属性留下空间
- 能与积分事件共同组成更清晰的业务轨迹

当前数据库已经进一步保证：

- `best_by` 建立到 `auth.users.id` 的物理外键
- 只有 `published` 资源可以被设为最佳
- 资源一旦下架，最佳推荐记录会被触发器自动撤销

## 6. 触发器与数据库函数

当前物理设计中，触发器和数据库函数并不是点缀，而是承担了重要职责：

| 名称 | 作用 |
|------|------|
| `set_updated_at()` | 自动维护多张表的 `updated_at` |
| `departments_assert_no_cycle()` | 阻止部门形成环 |
| `departments_closure_after_insert()` | 新增部门后维护闭包表 |
| `departments_closure_after_update_parent()` | 调整父部门后维护闭包表 |
| `audit_logs_block_mutation()` | 阻止审计日志被更新或删除 |
| `facility_validate_reservation_participants()` | 在事务提交时校验参与人数、申请人标记与 `applicant_id` 一致性 |
| `course_resource_best_requires_published()` | 阻止未发布资源被设为最佳 |
| `course_resource_drop_best_when_not_published()` | 资源离开发布态时自动撤销最佳推荐 |
| `handle_new_user()` | 新用户注册后自动生成 `profiles` 与默认角色 |
| `handle_user_email_confirmed()` | 邮箱验证完成后自动推动用户状态变化 |

从数据库课程设计角度，这些函数和触发器可以证明：

- 数据库不仅存数据，也主动维护关键业务不变量
- 树结构、审计一致性、身份联动等规则已经部分下沉到数据库层

## 7. 删除策略与历史保留

物理设计中删除策略不是统一模板，而是按业务语义区分：

- `CASCADE`
  - 用于依附型联系或事实，如桥接表、闭包表、最佳记录、下载事件
- `RESTRICT`
  - 用于不允许轻易删除仍被引用的主体，如房间、课程、专业
- `SET NULL`
  - 用于审核人、更新人、撤销人等辅助历史字段，保证主体记录继续存在

这种差异化设计比“全部级联”或“全部限制”更符合数据库设计原则，也更利于答辩说明。

## 8. 结论

如果从老师更看重的角度评价，当前物理设计已经具备以下优点：

- 核心关系大量采用显式物理外键
- 多对多联系普遍拆成规范的桥接表
- 层级关系采用了可解释的闭包表方案
- 关键业务场景配置了有业务语义的部分唯一索引和部分普通索引
- 审计日志使用 append-only 触发器增强历史真实性
- 模块字典与数据权限能力表体现了可扩展的领域建模
- 课程资源和积分事件已体现出“事实表 + 统计表”思路

当前最值得在答辩中主动解释的三点是：

1. `audit_logs.actor_user_id` 仍保留弱引用，但这已经是“历史真实性优先”的正式物理设计方案
2. `facility_bans` 当前以 `revoked_at is null` 判定活动封禁，“自然过期但未显式撤销”是如实保留的边界
3. `course_resources.major_id` 与 `course_resource_score_events.major_id/user_id` 属于受控冗余，但已经用复合外键锁定一致性
