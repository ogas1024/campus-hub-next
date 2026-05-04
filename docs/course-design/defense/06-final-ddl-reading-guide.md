# 最终版 DDL 阅读指南

答辩时优先看这一份：

`packages/db/final-ddl/course-design-final-schema.sql`

它已经把历史迁移里的 `ALTER TABLE` 收敛回最终结构。也就是说，你讲“表怎么设计、约束在哪里、触发器怎么兜底”时，不需要再在 `0006`、`0012`、`0014` 之间跳。

## 平台基础

| 问题 | Final DDL 位置 | 重点 |
|---|---|---|
| 平台配置怎么做 | `app_config`，约 109 行 | key-value + jsonb，配置不写死 |
| 部门树怎么建模 | `departments`，约 151 行；`department_closure`，约 174 行 | `parent_id` 表示直接父级，闭包表表示祖先后代 |
| 部门怎么防环 | `departments_assert_no_cycle()`，约 492 行 | 禁止把部门挂到自己的子树下 |
| 用户资料怎么扩展认证用户 | `profiles`，约 240 行 | `profiles.id` 一对一引用 `auth.users.id` |
| RBAC 怎么建模 | `user_roles`，约 302 行；`role_permissions`，约 314 行 | 两张桥接表表达多对多 |
| 数据范围怎么防自由文本 | `app_modules`，约 330 行；`data_scope_modules`，约 356 行；`role_data_scopes`，约 365 行 | 模块名由字典表和外键约束 |
| 自定义部门范围怎么依附主配置 | `role_data_scope_departments`，约 389 行 | `(role_id,module)` 复合外键 |
| 审计日志为什么不能改 | `audit_logs`，约 407 行；`audit_logs_block_mutation()`，约 444 行 | append-only，禁止更新和删除 |
| 新用户怎么自动有资料和默认角色 | `handle_new_user()`，约 617 行 | Auth 触发器自动创建 profile 和 user 角色 |

## 功能房预约

| 问题 | Final DDL 位置 | 重点 |
|---|---|---|
| 功能房表怎么拆 | `facility_buildings`，约 749 行；`facility_rooms`，约 775 行；`facility_reservations`，约 811 行；`facility_reservation_participants`，约 921 行；`facility_bans`，约 943 行 | 楼房、房间、预约、参与人、封禁分表 |
| 同房间时间冲突怎么防 | `facility_reservations_room_active_time_excl`，约 897 行 | `EXCLUDE USING gist` 拒绝活跃预约时间重叠 |
| 为什么 `pending` 也算冲突 | 同上 | `pending/approved` 表示占用或预占，`rejected/cancelled` 不占用 |
| 状态和审核字段怎么一致 | `facility_reservations_status_consistency_chk`，约 833 行 | `approved/rejected/cancelled` 必须有对应证据字段 |
| 参与人至少 3 人怎么保证 | `facility_validate_reservation_participants()`，约 966 行 | 跨行统计，普通 `CHECK` 做不了 |
| 为什么触发器延迟执行 | 约 1055 行和 1063 行 | 允许事务中先插主表、后插参与人，提交时检查最终态 |
| 封禁怎么防重复活动记录 | `facility_bans_user_active_uq`，约 959 行 | 同一用户最多一条未撤销封禁 |

## 课程资源分享

| 问题 | Final DDL 位置 | 重点 |
|---|---|---|
| 专业、课程、资源怎么建模 | `majors`，约 1074 行；`courses`，约 1110 行；`course_resources`，约 1142 行 | 主数据和资源主体分层 |
| 专业负责人为什么单独表 | `major_leads`，约 1099 行 | 多对多桥接表 |
| 文件/外链字段怎么防混填 | `course_resources_file_or_link_chk`，约 1203 行 | `resource_type` 决定字段组合，草稿态允许暂缺 |
| `course_id` 和 `major_id` 同时存怎么解释 | `course_resources_course_major_fk`，约 1195 行 | 受控冗余，用复合外键保证一致 |
| 资源状态和时间字段怎么一致 | `course_resources_status_consistency_chk`，约 1251 行 | 状态机约束 |
| 文件和链接怎么去重 | 约 1299 行和 1303 行 | 同课程下按 `sha256` / 规范化 URL 部分唯一 |
| 最佳推荐为什么单独表 | `course_resource_bests`，约 1322 行 | 需要记录推荐人和推荐时间 |
| 积分为什么不会加给错误用户 | `course_resource_score_events_resource_user_fk`，约 1372 行 | `(resource_id,user_id)` 必须匹配资源作者 |
| 未发布资源能否设为最佳 | `course_resource_best_requires_published()`，约 1388 行 | 触发器查询资源状态并拒绝非法写入 |
| 下架后最佳推荐怎么办 | `course_resource_drop_best_when_not_published()`，约 1423 行 | 状态离开 published 自动删除最佳记录 |

## 答辩时怎么说

老师问“代码在哪里”，先指 final DDL：

> 最终结构我已经收敛到 `course-design-final-schema.sql`，这份是答辩用的完整 DDL。历史迁移只是演进过程，最终约束已经直接写进建表和触发器定义里。

老师问“为什么还有 migrations”，可以这样答：

> migrations 保留是为了说明已经迁移过的数据库如何增量演进；final DDL 是新建空库和答辩说明时使用的最终结构稿，两者服务的目的不同。

