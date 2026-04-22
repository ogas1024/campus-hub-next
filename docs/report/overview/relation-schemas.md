# 校园生活平台总体关系模式总表

## 1. 编写目的

本文件用于从全局角度汇总当前数据库课程设计主线中的关系模式，为课程设计报告中的“逻辑结构设计”章节提供直接素材。

本表重点说明：

- 每张核心表的业务含义
- 主键、候选键、外键
- 关键完整性约束
- 当前规范化判断
- 仍需重点解释的设计取舍

## 2. 说明

- 本表仅覆盖当前课程设计主线：
  - 平台基础子系统
  - 功能房预约子系统
  - 课程资源分享子系统
- `auth.users` 作为外部身份事实源被多个业务表引用，但不在本文件中展开其完整字段设计
- 所有结论以当前迁移脚本中的真实结构为准

## 3. 枚举与域约束

| 名称 | 类型 | 当前取值 |
|------|------|----------|
| `profile_status` | 枚举 | `active`、`disabled`、`banned`、`pending_approval`、`pending_email_verification` |
| `data_scope_type` | 枚举 | `all`、`custom`、`dept`、`dept_and_child`、`self`、`none` |
| `course_resource_type` | 枚举 | `file`、`link` |
| `course_resource_status` | 枚举 | `draft`、`pending`、`published`、`rejected`、`unpublished` |
| `course_resource_score_event_type` | 枚举 | `approve`、`best` |
| `facility_reservation_status` | 枚举 | `pending`、`approved`、`rejected`、`cancelled` |

## 4. 平台基础子系统关系模式

| 表名 | 业务含义 | 主键 | 候选键/唯一性 | 外键 | 关键约束 | 规范化判断 | 备注 |
|------|----------|------|---------------|------|----------|------------|------|
| `app_config` | 系统配置项 | `key` | `key` | `updated_by -> auth.users.id` | 配置值使用 `jsonb` | 工程化配置表，不作为范式亮点 | 建议在报告中弱化 |
| `profiles` | 用户业务资料 | `id` | `student_id` 唯一；`username` 当前唯一但可空 | `id -> auth.users.id` | 学号格式检查、状态枚举 | 基本满足 3NF | 身份与业务资料分离 |
| `departments` | 部门树节点 | `id` | 无强候选键 | `parent_id -> departments.id` | 父子层级、自引用 | 基本满足 3NF | 需配合闭包表理解 |
| `department_closure` | 部门祖先-后代关系 | `(ancestor_id, descendant_id)` | 同主键 | `ancestor_id/descendant_id -> departments.id` | `depth >= 0` | 派生关系表，不按普通冗余看待 | 支撑“部门及子部门”查询 |
| `user_departments` | 用户-部门关系 | `(user_id, department_id)` | 同主键 | `user_id -> auth.users.id`，`department_id -> departments.id` | 复合主键去重 | 接近 BCNF | 多对多拆分 |
| `positions` | 岗位字典 | `id` | `name` 唯一；`code` 当前唯一但可空 | 无 | `enabled` 默认值 | 基本满足 3NF | 作为岗位维度 |
| `user_positions` | 用户-岗位关系 | `(user_id, position_id)` | 同主键 | `user_id -> auth.users.id`，`position_id -> positions.id` | 复合主键去重 | 接近 BCNF | 多对多拆分 |
| `roles` | 角色字典 | `id` | `code` | 无 | 角色编码唯一 | 基本满足 3NF | RBAC 核心主体 |
| `permissions` | 权限字典 | `id` | `code` | 无 | 权限编码唯一 | 基本满足 3NF | 权限码字典 |
| `app_modules` | 系统模块字典 | `code` | `code`；`name` 唯一 | 无 | `code` 格式检查、启停/排序默认值 | 基本满足 3NF | 模块主数据字典 |
| `data_scope_modules` | 支持数据权限的模块能力表 | `module_code` | 同主键 | `module_code -> app_modules.code` | 仅登记允许配置数据范围的模块 | 接近 BCNF | 将“支持数据权限”从普通模块中独立建模 |
| `user_roles` | 用户-角色关系 | `(user_id, role_id)` | 同主键 | `user_id -> auth.users.id`，`role_id -> roles.id` | 复合主键去重 | 接近 BCNF | 多对多拆分 |
| `role_permissions` | 角色-权限关系 | `(role_id, permission_id)` | 同主键 | `role_id -> roles.id`，`permission_id -> permissions.id` | 复合主键去重 | 接近 BCNF | 多对多拆分 |
| `role_data_scopes` | 角色在模块上的数据范围 | `(role_id, module)` | 同主键 | `role_id -> roles.id`，`module -> data_scope_modules.module_code` | `scope_type` 为枚举，`module` 受能力表外键约束 | 基本满足 3NF | `module` 已不再是自由文本 |
| `role_data_scope_departments` | 自定义数据范围的部门映射 | `(role_id, module, department_id)` | 同主键 | `(role_id, module) -> role_data_scopes`，`department_id -> departments.id` | 复合外键 | 接近 BCNF | 学院派亮点之一 |
| `audit_logs` | 审计日志 | `id` | 无 | `actor_user_id` 保持弱引用，不建立物理外键 | append-only，禁止更新删除；`actor_roles` JSON 结构检查 | 审计历史表，快照字段需单独解释 | `actor_name`、`actor_email`、`actor_roles` 属于审计快照 |

## 5. 功能房预约子系统关系模式

| 表名 | 业务含义 | 主键 | 候选键/唯一性 | 外键 | 关键约束 | 规范化判断 | 备注 |
|------|----------|------|---------------|------|----------|------------|------|
| `facility_buildings` | 楼房 | `id` | `name` 在未删除记录中唯一 | 无 | 启停、排序 | 基本满足 3NF | 空间主体 |
| `facility_rooms` | 房间 | `id` | `(building_id, floor_no, name)` 在未删除记录中唯一 | `building_id -> facility_buildings.id` | 容量非负 | 基本满足 3NF | 楼房下的资源实体 |
| `facility_reservations` | 预约主体 | `id` | 无 | `room_id -> facility_rooms.id`，`applicant_id/reviewed_by/cancelled_by/created_by/updated_by -> auth.users.id` | `end_at > start_at`，有效预约时间段排斥，状态与审核/取消字段一致性检查 | 基本满足 3NF | 关键业务表，已用 `EXCLUDE` 约束控制活跃预约冲突 |
| `facility_reservation_participants` | 预约参与人 | `(reservation_id, user_id)` | 同主键；每预约最多一个 `is_applicant=true` | `reservation_id -> facility_reservations.id`，`user_id -> auth.users.id` | 复合主键，部分唯一索引，延迟约束触发器保证“至少 3 人 + 恰有一个申请人 + 与 `applicant_id` 一致” | 接近 BCNF | 跨表一致性已下沉到数据库层 |
| `facility_bans` | 预约模块封禁记录 | `id` | 当前以部分唯一索引保证“未撤销封禁唯一” | `user_id/created_by/revoked_by -> auth.users.id` | `revoked_at >= created_at` | 基本满足 3NF | 仍存在“自然过期但未撤销”细节 |

## 6. 课程资源分享子系统关系模式

| 表名 | 业务含义 | 主键 | 候选键/唯一性 | 外键 | 关键约束 | 规范化判断 | 备注 |
|------|----------|------|---------------|------|----------|------------|------|
| `majors` | 专业 | `id` | `name` 在未删除记录中唯一 | 无 | 启停、排序 | 基本满足 3NF | 教学层级顶层实体 |
| `major_leads` | 专业负责人映射 | `(major_id, user_id)` | 同主键 | `major_id -> majors.id`，`user_id -> auth.users.id` | 复合主键去重 | 接近 BCNF | 多对多拆分 |
| `courses` | 课程 | `id` | `(major_id, name)` 在未删除记录中唯一 | `major_id -> majors.id` | 启停、排序 | 基本满足 3NF | 隶属于专业 |
| `course_resources` | 课程资源主体 | `id` | 文件资源 `(course_id, sha256)` 唯一；外链资源 `(course_id, link_url_normalized)` 唯一 | `major_id -> majors.id`，`(course_id, major_id) -> courses(id, major_id)`，`reviewed_by/created_by/updated_by -> auth.users.id` | 资源类型与字段组合检查、状态一致性 `CHECK`、下载计数非负 | 主体结构丰富，但存在受控冗余 | `major_id` 已由复合外键锁定到课程所属专业 |
| `course_resource_bests` | 最佳推荐事实 | `resource_id` | 同主键 | `resource_id -> course_resources.id`，`best_by -> auth.users.id` | 每个资源最多一条最佳记录；仅允许作用于已发布资源 | 基本满足 3NF | 通过外键与触发器共同保证“published-only best” |
| `course_resource_download_events` | 下载事件事实 | `id` | 无 | `resource_id -> course_resources.id`，`user_id -> auth.users.id` | 追加记录 | 基本满足 3NF | 统计事实表 |
| `course_resource_score_events` | 积分事件事实 | `id` | `(user_id, resource_id, event_type)` 唯一 | `user_id -> auth.users.id`，`major_id -> majors.id`，`(resource_id, major_id) -> course_resources(id, major_id)`，`(resource_id, user_id) -> course_resources(id, created_by)` | `delta > 0` | 事件表结构清晰，但存在受控冗余 | `major_id` 与 `user_id` 已用复合外键锁定一致性 |

## 7. 删除策略汇总

| 场景 | 当前策略 | 业务含义 |
|------|----------|----------|
| 依附型桥接表删除主体 | `CASCADE` | 如 `user_roles`、`role_permissions`、`major_leads`、参与人关系等依附主体存在 |
| 历史业务主体引用上级资源 | `RESTRICT` | 如房间不能在仍有预约引用时被随意删除 |
| 审核人、更新人、撤销人等历史辅助字段 | `SET NULL` | 保留业务记录主体，不因辅助用户被删而破坏历史 |
| 审计日志主体删除 | 当前不依赖物理外键 | 优先保留审计历史真实性 |

## 8. 从老师视角最值得强调的点

如果从课程设计答辩角度来讲，这套关系模式最值得优先强调的地方是：

- 平台基础模块中大量使用了显式物理外键和桥接表，并新增了模块字典与能力表
- `department_closure` 与 `role_data_scope_departments` 体现了较强数据库建模能力
- 功能房预约中已经把时间冲突、参与人一致性、状态一致性下沉到数据库对象
- 课程资源中已经把去重、发布态最佳、作者/专业一致性下沉到数据库约束
- 存在的冗余字段不是无意识重复，而是可以解释的受控冗余

## 9. 当前仍需重点解释的设计取舍

1. `audit_logs.actor_user_id` 故意不建物理外键，优先保留历史审计事实，并通过 `actor_name`、`actor_email`、`actor_roles` 快照保证可读性
2. `course_resources.major_id` 与 `course_resource_score_events.major_id/user_id` 属于受控冗余，但已通过复合唯一键和复合外键锁定一致性，以换取按专业/作者统计时的查询效率
3. `facility_bans` 当前仍以 `revoked_at is null` 表示活动封禁，“自然过期但未显式撤销”的语义可作为真实剩余边界如实说明
4. `app_config` 更偏工程化配置表，适合作为平台支撑对象介绍，不宜在答辩中充当关系建模亮点
