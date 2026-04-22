# 校园生活平台核心数据字典

## 1. 编写说明

本数据字典仅覆盖当前课程设计主线中的核心表，不包含历史模块。

字段说明列含义如下：

- `字段名`
  - 当前数据库字段名
- `类型`
  - PostgreSQL 类型
- `可空`
  - `否` 表示 `NOT NULL`
- `默认值/约束`
  - 说明默认值、主键、外键、唯一索引、检查约束等
- `说明`
  - 字段的业务含义

## 2. 平台基础子系统

### 2.1 `app_config`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `key` | `text` | 否 | 主键 | 配置项键 |
| `value` | `jsonb` | 否 | 无 | 配置项值 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |
| `updated_by` | `uuid` | 是 | 外键到 `auth.users.id`，`ON DELETE SET NULL` | 最近更新人 |

### 2.2 `profiles`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，外键到 `auth.users.id`，`ON DELETE CASCADE` | 用户标识 |
| `name` | `text` | 否 | 无 | 姓名 |
| `username` | `text` | 是 | 唯一索引 | 用户名 |
| `student_id` | `text` | 否 | 唯一索引，16 位数字检查 | 学号 |
| `avatar_url` | `text` | 是 | 无 | 头像地址 |
| `status` | `profile_status` | 否 | 默认 `pending_email_verification` | 用户业务状态 |
| `last_login_at` | `timestamptz` | 是 | 无 | 最近登录时间 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |

### 2.3 `departments`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 部门标识 |
| `name` | `text` | 否 | 无 | 部门名称 |
| `parent_id` | `uuid` | 是 | 外键到 `departments.id` | 上级部门 |
| `sort` | `integer` | 否 | 默认 `0` | 排序值 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |

### 2.4 `department_closure`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `ancestor_id` | `uuid` | 否 | 主键组成，外键到 `departments.id`，`ON DELETE CASCADE` | 祖先部门 |
| `descendant_id` | `uuid` | 否 | 主键组成，外键到 `departments.id`，`ON DELETE CASCADE` | 后代部门 |
| `depth` | `integer` | 否 | `CHECK (depth >= 0)` | 层级距离，0 表示自身 |

### 2.5 `user_departments`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `user_id` | `uuid` | 否 | 主键组成，外键到 `auth.users.id`，`ON DELETE CASCADE` | 用户 |
| `department_id` | `uuid` | 否 | 主键组成，外键到 `departments.id`，`ON DELETE RESTRICT` | 部门 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 关联建立时间 |

### 2.6 `positions`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 岗位标识 |
| `name` | `text` | 否 | 唯一索引 | 岗位名称 |
| `sort` | `integer` | 否 | 默认 `0` | 排序值 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |
| `code` | `text` | 是 | 唯一索引 | 岗位编码 |
| `description` | `text` | 是 | 无 | 岗位描述 |
| `enabled` | `boolean` | 否 | 默认 `true` | 是否启用 |

### 2.7 `user_positions`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `user_id` | `uuid` | 否 | 主键组成，外键到 `auth.users.id`，`ON DELETE CASCADE` | 用户 |
| `position_id` | `uuid` | 否 | 主键组成，外键到 `positions.id`，`ON DELETE CASCADE` | 岗位 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 关联建立时间 |

### 2.8 `roles`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 角色标识 |
| `code` | `text` | 否 | 唯一索引 | 角色编码 |
| `name` | `text` | 否 | 无 | 角色名称 |
| `description` | `text` | 是 | 无 | 角色说明 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |

### 2.9 `permissions`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 权限标识 |
| `code` | `text` | 否 | 唯一索引 | 权限编码 |
| `description` | `text` | 是 | 无 | 权限说明 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |

### 2.10 `user_roles`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `user_id` | `uuid` | 否 | 主键组成，外键到 `auth.users.id`，`ON DELETE CASCADE` | 用户 |
| `role_id` | `uuid` | 否 | 主键组成，外键到 `roles.id`，`ON DELETE CASCADE` | 角色 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 关联建立时间 |

### 2.11 `role_permissions`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `role_id` | `uuid` | 否 | 主键组成，外键到 `roles.id`，`ON DELETE CASCADE` | 角色 |
| `permission_id` | `uuid` | 否 | 主键组成，外键到 `permissions.id`，`ON DELETE CASCADE` | 权限 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 关联建立时间 |

### 2.12 `app_modules`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `code` | `text` | 否 | 主键，`CHECK (code ~ '^[a-z][a-z0-9_]*$')` | 模块编码 |
| `name` | `text` | 否 | 唯一索引 | 模块名称 |
| `enabled` | `boolean` | 否 | 默认 `true` | 是否启用 |
| `sort` | `integer` | 否 | 默认 `0` | 排序值 |
| `remark` | `text` | 是 | 无 | 模块备注 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |

### 2.13 `data_scope_modules`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `module_code` | `text` | 否 | 主键，外键到 `app_modules.code`，`ON DELETE RESTRICT` | 支持数据权限的模块编码 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 登记时间 |

### 2.14 `role_data_scopes`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `role_id` | `uuid` | 否 | 主键组成，外键到 `roles.id`，`ON DELETE CASCADE` | 角色 |
| `module` | `text` | 否 | 主键组成，外键到 `data_scope_modules.module_code`，`ON DELETE RESTRICT` | 模块标识 |
| `scope_type` | `data_scope_type` | 否 | 枚举 | 数据范围类型 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |

### 2.15 `role_data_scope_departments`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `role_id` | `uuid` | 否 | 主键组成，复合外键组成 | 角色 |
| `module` | `text` | 否 | 主键组成，复合外键组成 | 模块标识 |
| `department_id` | `uuid` | 否 | 主键组成，外键到 `departments.id`，`ON DELETE CASCADE` | 自定义范围中的部门 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 建立时间 |

### 2.16 `audit_logs`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 日志标识 |
| `occurred_at` | `timestamptz` | 否 | 默认 `now()` | 发生时间 |
| `actor_user_id` | `uuid` | 否 | 弱引用，当前无物理外键 | 操作者用户标识 |
| `actor_name` | `text` | 是 | 无 | 操作者姓名快照 |
| `actor_email` | `text` | 是 | 无 | 操作者邮箱快照 |
| `actor_roles` | `jsonb` | 是 | `CHECK`：必须为对象；若含 `roleCodes`，其值必须为数组 | 操作者角色快照 |
| `action` | `text` | 否 | 无 | 操作动作 |
| `target_type` | `text` | 否 | 无 | 对象类型 |
| `target_id` | `text` | 否 | 无 | 对象标识 |
| `success` | `boolean` | 否 | 默认 `true` | 是否成功 |
| `error_code` | `text` | 是 | 无 | 错误码 |
| `reason` | `text` | 是 | 无 | 操作原因 |
| `diff` | `jsonb` | 是 | 无 | 变更差异 |
| `request_id` | `text` | 是 | 无 | 请求标识 |
| `ip` | `text` | 是 | 无 | IP |
| `user_agent` | `text` | 是 | 无 | 客户端信息 |

## 3. 功能房预约子系统

### 3.1 `facility_buildings`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 楼房标识 |
| `name` | `text` | 否 | 未删除记录唯一索引 | 楼房名称 |
| `enabled` | `boolean` | 否 | 默认 `true` | 是否启用 |
| `sort` | `integer` | 否 | 默认 `0` | 排序值 |
| `remark` | `text` | 是 | 无 | 备注 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |
| `deleted_at` | `timestamptz` | 是 | 无 | 软删除时间 |

### 3.2 `facility_rooms`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 房间标识 |
| `building_id` | `uuid` | 否 | 外键到 `facility_buildings.id`，`ON DELETE RESTRICT` | 所属楼房 |
| `floor_no` | `integer` | 否 | 无 | 楼层号，可为负数 |
| `name` | `text` | 否 | 与楼房、楼层组成唯一索引 | 房间名称 |
| `capacity` | `integer` | 是 | `CHECK (capacity >= 0)` | 容量 |
| `enabled` | `boolean` | 否 | 默认 `true` | 是否启用 |
| `sort` | `integer` | 否 | 默认 `0` | 排序值 |
| `remark` | `text` | 是 | 无 | 备注 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |
| `deleted_at` | `timestamptz` | 是 | 无 | 软删除时间 |

### 3.3 `facility_reservations`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 预约标识 |
| `room_id` | `uuid` | 否 | 外键到 `facility_rooms.id`，`ON DELETE RESTRICT` | 预约房间 |
| `applicant_id` | `uuid` | 否 | 外键到 `auth.users.id`，`ON DELETE RESTRICT` | 申请人 |
| `purpose` | `text` | 否 | 无 | 预约用途 |
| `start_at` | `timestamptz` | 否 | 无 | 开始时间 |
| `end_at` | `timestamptz` | 否 | `CHECK (end_at > start_at)` | 结束时间 |
| `status` | `facility_reservation_status` | 否 | 无默认值；`facility_reservations_status_consistency_chk` | 预约状态 |
| `reviewed_by` | `uuid` | 是 | 外键到 `auth.users.id`，`ON DELETE SET NULL` | 审核人 |
| `reviewed_at` | `timestamptz` | 是 | 状态一致性检查 | 审核时间 |
| `reject_reason` | `text` | 是 | 状态一致性检查 | 驳回原因 |
| `cancelled_by` | `uuid` | 是 | 外键到 `auth.users.id`，`ON DELETE SET NULL` | 取消人 |
| `cancelled_at` | `timestamptz` | 是 | 状态一致性检查 | 取消时间 |
| `cancel_reason` | `text` | 是 | 无 | 取消原因 |
| `created_by` | `uuid` | 否 | 外键到 `auth.users.id`，`ON DELETE RESTRICT` | 创建人 |
| `updated_by` | `uuid` | 是 | 外键到 `auth.users.id`，`ON DELETE SET NULL` | 更新人 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |

### 3.4 `facility_reservation_participants`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `reservation_id` | `uuid` | 否 | 主键组成，外键到 `facility_reservations.id`，`ON DELETE CASCADE` | 预约 |
| `user_id` | `uuid` | 否 | 主键组成，外键到 `auth.users.id`，`ON DELETE RESTRICT` | 参与用户 |
| `is_applicant` | `boolean` | 否 | 默认 `false`，部分唯一索引；并与延迟约束触发器共同保证申请人一致性 | 是否申请人 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 建立时间 |

### 3.5 `facility_bans`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 封禁标识 |
| `user_id` | `uuid` | 否 | 外键到 `auth.users.id`，`ON DELETE RESTRICT` | 被封禁用户 |
| `reason` | `text` | 是 | 无 | 封禁原因 |
| `expires_at` | `timestamptz` | 是 | 无 | 到期时间 |
| `revoked_at` | `timestamptz` | 是 | `CHECK (revoked_at is null or revoked_at >= created_at)` | 撤销时间 |
| `revoked_reason` | `text` | 是 | 无 | 撤销原因 |
| `created_by` | `uuid` | 否 | 外键到 `auth.users.id`，`ON DELETE RESTRICT` | 封禁创建人 |
| `revoked_by` | `uuid` | 是 | 外键到 `auth.users.id`，`ON DELETE SET NULL` | 撤销人 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |

## 4. 课程资源分享子系统

### 4.1 `majors`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 专业标识 |
| `name` | `text` | 否 | 未删除记录唯一索引 | 专业名称 |
| `enabled` | `boolean` | 否 | 默认 `true` | 是否启用 |
| `sort` | `integer` | 否 | 默认 `0` | 排序值 |
| `remark` | `text` | 是 | 无 | 备注 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |
| `deleted_at` | `timestamptz` | 是 | 无 | 软删除时间 |

### 4.2 `major_leads`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `major_id` | `uuid` | 否 | 主键组成，外键到 `majors.id`，`ON DELETE CASCADE` | 专业 |
| `user_id` | `uuid` | 否 | 主键组成，外键到 `auth.users.id`，`ON DELETE CASCADE` | 负责人用户 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 建立时间 |

### 4.3 `courses`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 课程标识 |
| `major_id` | `uuid` | 否 | 外键到 `majors.id`，`ON DELETE RESTRICT` | 所属专业 |
| `name` | `text` | 否 | 与专业组成未删除记录唯一索引 | 课程名称 |
| `code` | `text` | 是 | 无 | 课程代码 |
| `enabled` | `boolean` | 否 | 默认 `true` | 是否启用 |
| `sort` | `integer` | 否 | 默认 `0` | 排序值 |
| `remark` | `text` | 是 | 无 | 备注 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |
| `deleted_at` | `timestamptz` | 是 | 无 | 软删除时间 |

### 4.4 `course_resources`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 资源标识 |
| `major_id` | `uuid` | 否 | 外键到 `majors.id`，`ON DELETE RESTRICT`；并参与复合外键 `course_resources_course_major_fk` | 专业维度 |
| `course_id` | `uuid` | 否 | 外键到 `courses.id`，`ON DELETE RESTRICT`；并参与复合外键 `course_resources_course_major_fk` | 所属课程 |
| `title` | `text` | 否 | 无 | 资源标题 |
| `description` | `text` | 否 | 无 | 资源描述 |
| `resource_type` | `course_resource_type` | 否 | 枚举 | 资源类型 |
| `status` | `course_resource_status` | 否 | 默认 `draft`；`course_resources_status_consistency_chk` | 资源状态 |
| `file_bucket` | `text` | 是 | 文件型约束 | 文件 bucket |
| `file_key` | `text` | 是 | 文件型约束 | 文件对象键 |
| `file_name` | `text` | 是 | 文件型约束 | 文件名 |
| `file_size` | `integer` | 是 | `CHECK (file_size is null or file_size >= 0)` | 文件大小 |
| `sha256` | `text` | 是 | 文件型唯一索引 | 文件哈希 |
| `link_url` | `text` | 是 | 外链型约束 | 原始链接 |
| `link_url_normalized` | `text` | 是 | 外链型唯一索引 | 规范化链接 |
| `submitted_at` | `timestamptz` | 是 | 状态一致性检查 | 提交审核时间 |
| `reviewed_by` | `uuid` | 是 | 外键到 `auth.users.id`，`ON DELETE SET NULL` | 审核人 |
| `reviewed_at` | `timestamptz` | 是 | 状态一致性检查 | 审核时间 |
| `review_comment` | `text` | 是 | 状态一致性检查 | 审核意见 |
| `published_at` | `timestamptz` | 是 | 状态一致性检查 | 发布时间 |
| `unpublished_at` | `timestamptz` | 是 | 状态一致性检查 | 下架时间 |
| `download_count` | `integer` | 否 | 默认 `0`，`CHECK (download_count >= 0)` | 下载次数冗余统计 |
| `last_download_at` | `timestamptz` | 是 | 无 | 最近下载时间 |
| `created_by` | `uuid` | 否 | 外键到 `auth.users.id`，`ON DELETE RESTRICT` | 创建人 |
| `updated_by` | `uuid` | 是 | 外键到 `auth.users.id`，`ON DELETE SET NULL` | 更新人 |
| `created_at` | `timestamptz` | 否 | 默认 `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 默认 `now()` | 更新时间 |
| `deleted_at` | `timestamptz` | 是 | 无 | 软删除时间 |

### 4.5 `course_resource_bests`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `resource_id` | `uuid` | 否 | 主键，外键到 `course_resources.id`，`ON DELETE CASCADE`；触发器要求资源处于 `published` | 被推荐资源 |
| `best_by` | `uuid` | 否 | 外键到 `auth.users.id`，`ON DELETE RESTRICT` | 推荐人 |
| `best_at` | `timestamptz` | 否 | 默认 `now()` | 推荐时间 |

### 4.6 `course_resource_download_events`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 事件标识 |
| `resource_id` | `uuid` | 否 | 外键到 `course_resources.id`，`ON DELETE CASCADE` | 资源 |
| `user_id` | `uuid` | 是 | 外键到 `auth.users.id`，`ON DELETE SET NULL` | 下载用户 |
| `occurred_at` | `timestamptz` | 否 | 默认 `now()` | 发生时间 |
| `ip` | `text` | 是 | 无 | IP |
| `user_agent` | `text` | 是 | 无 | 客户端信息 |

### 4.7 `course_resource_score_events`

| 字段名 | 类型 | 可空 | 默认值/约束 | 说明 |
|--------|------|------|-------------|------|
| `id` | `uuid` | 否 | 主键，默认 `gen_random_uuid()` | 事件标识 |
| `user_id` | `uuid` | 否 | 外键到 `auth.users.id`，`ON DELETE CASCADE`；并参与复合外键 `course_resource_score_events_resource_user_fk` | 得分用户 |
| `major_id` | `uuid` | 否 | 外键到 `majors.id`，`ON DELETE RESTRICT`；并参与复合外键 `course_resource_score_events_resource_major_fk` | 专业维度 |
| `resource_id` | `uuid` | 否 | 外键到 `course_resources.id`，`ON DELETE CASCADE`；并参与两组复合外键 | 资源 |
| `event_type` | `course_resource_score_event_type` | 否 | 枚举，联合唯一约束组成 | 事件类型 |
| `delta` | `integer` | 否 | `CHECK (delta > 0)` | 分值增量 |
| `occurred_at` | `timestamptz` | 否 | 默认 `now()` | 发生时间 |

## 5. 使用建议

这份数据字典最适合在以下三个场景中使用：

1. 撰写课程设计报告中的“数据字典”章节
2. 说明每张表的字段设计和完整性约束
3. 答辩时解释“这个字段为什么存在、为什么允许为空、为什么有这个默认值或约束”

如果后续继续推进数据库课程设计，建议下一步直接在此基础上补：

- 典型 SQL
- 索引设计依据
- 关键事务说明
- 约束失败测试样例
