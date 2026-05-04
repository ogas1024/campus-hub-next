# 老师问题到代码位置映射

这份表用于“老师问到某个具体需求时，你马上知道该翻哪段代码”。现在数据库结构统一看最终版 DDL：

`packages/db/final-ddl/course-design-final-schema.sql`

历史 `packages/db/migrations/*.sql` 只作为演进来源，不再作为答辩时查最终结构的主入口。

## 功能房预约

| 老师可能问法 | 你要回答的核心点 | Final DDL 位置 | 服务层位置 | 一句话答法 |
|---|---|---|---|---|
| 用户预约功能房，你数据库怎么设计？ | 楼房、房间、预约、参与人、封禁分表 | `749-959` | `facilities.service.ts:382-445` | 楼房/房间是主数据，预约是事务主表，参与人是多对多联系表，封禁独立表达治理记录。 |
| 如何防止同一房间同一时间被重复预约？ | 事务预查 + 行锁 + 排斥约束 | `811-906` | `facilities.service.ts:346-370`、`407-445` | 服务层先锁房间并查重叠，数据库用 `EXCLUDE USING gist` 最终拒绝重叠区间。 |
| 两个用户并发预约同一时间段怎么办？ | 不能只靠“先查再插” | `897-906` | `facilities.service.ts:407-445` | 并发下预查可能有竞态，所以数据库排斥约束是最终硬保护。 |
| 为什么 `pending` 也参与冲突？ | 待审核也预占资源 | `897-906` | `facilities.service.ts:361-365` | `pending/approved` 都占用或预占房间，`rejected/cancelled` 不占用。 |
| 预约至少 3 人怎么保证？ | 延迟约束触发器 | `966-1066` | `facilities.service.ts:335-343` | 服务层先规范化，数据库提交时统计参与人数量并兜底。 |
| 申请人必须在参与人里怎么保证？ | 部分唯一索引 + 触发器匹配 `applicant_id` | `921-938`、`966-1047` | `facilities.service.ts:335-343` | 每条预约最多一个申请人标记，且标记用户必须等于主表申请人。 |
| 为什么参与人约束不用普通 `CHECK`？ | 跨行、跨表聚合规则 | `966-1047` | `facilities.service.ts:335-343` | `CHECK` 只能看当前行，参与人数和申请人一致性要触发器统计。 |
| 为什么触发器要 `deferrable initially deferred`？ | 允许事务中间态，提交时校验最终态 | `1055-1066` | `facilities.service.ts:407-445` | 主表先插、参与人后插，立即校验会误杀正常事务。 |
| 状态和审核字段如何一致？ | 状态机 `CHECK` | `833-895` | `facilities.service.ts:526-587` | `approved` 必须有审核人和时间，`rejected` 必须有驳回原因，`cancelled` 必须有取消字段。 |
| 封禁用户怎么限制预约？ | `facility_bans` + 创建前检查 + 活动封禁唯一 | `943-959` | `facilities.service.ts:128-139` | 封禁独立建表，服务层创建前检查，数据库保证同一用户最多一条未撤销封禁。 |
| 封禁有什么边界？ | 自然过期但未撤销仍占唯一索引 | `943-959` | `facilities.service.ts:128-139` | 服务层会放过已过期封禁，但唯一索引仍按 `revoked_at is null` 判断活动记录。 |
| 功能房模块符合第几范式？ | 主体表 3NF，参与人表接近 BCNF | `749-959` | `facilities.service.ts:382-445` | 房间元数据不重复进预约表，参与人用复合主键联系表表达。 |

## 课程资源分享

| 老师可能问法 | 你要回答的核心点 | Final DDL 位置 | 服务层位置 | 一句话答法 |
|---|---|---|---|---|
| 专业、课程、资源怎么建模？ | 主数据层 + 资源主体 + 事实表 | `1074-1379` | `courseResources.service.ts` | 专业包含课程，课程拥有资源，下载/积分/最佳推荐独立成事实或派生事实。 |
| 专业负责人为什么是单独表？ | 多对多 | `1099-1107` | `courseResources.service.ts` | 一个专业可多个负责人，一个用户可负责多个专业，所以用 `major_leads`。 |
| 如何防止同课程重复文件？ | `(course_id,sha256)` 部分唯一索引 | `1299-1302` | `courseResources.service.ts:998-1011` | 文件内容用 `sha256` 去重，同课程下相同文件不能重复。 |
| 如何防止同课程重复外链？ | `link_url_normalized` + 唯一索引 | `1303-1306` | `courseResources.utils.ts:18-51` | 先规范化 URL，再按课程维度唯一。 |
| 文件资源和外链资源字段怎么防止混填？ | `resource_type` + `CHECK` | `1203-1249` | `courseResources.service.ts:993-1012` | 文件型只能有文件字段，外链型只能有链接字段，草稿态允许暂缺明细。 |
| `course_id` 和 `major_id` 同时存在是否违反 3NF？ | 受控冗余 | `1142-1201` | `courseResources.service.ts:920-924` | 是有意冗余，用于专业过滤和统计，并用复合外键锁定一致性。 |
| 手工写错资源专业会怎样？ | 复合外键拒绝 | `1195-1201` | `courseResources.service.ts:920-924` | `course_resources(course_id,major_id)` 必须匹配真实课程所属专业。 |
| 资源状态和时间字段如何一致？ | 状态机 `CHECK` | `1251-1296` | `courseResources.service.ts:1660-1874` | `pending/published/unpublished` 都有对应的提交、审核、发布、下架字段要求。 |
| 审核通过为什么要事务？ | 发布资源 + 写积分事件原子化 | `1351-1379` | `courseResources.service.ts:1848-1874` | 审核通过和首次积分必须一起成功或一起回滚。 |
| 重复审核会不会重复加分？ | 唯一约束 + `onConflictDoNothing()` | `1366-1368` | `courseResources.service.ts:1865-1874` | 同一用户同一资源同一事件类型只记一次分。 |
| 积分为什么不会加给错误用户？ | `(resource_id,user_id)` 复合外键 | `1372-1378` | `courseResources.service.ts:1865-1874` | 积分事件用户必须等于资源作者 `created_by`。 |
| 未发布资源能否设为最佳？ | 服务层检查 + 数据库触发器 | `1388-1421` | `courseResources.service.ts:2020-2023` | 最佳推荐只能作用于 `published` 资源，数据库触发器兜底。 |
| 已最佳资源下架后怎么办？ | 状态变化触发器删除最佳记录 | `1423-1443` | `courseResources.service.ts:2016-2049` | 资源离开发布态时自动撤销最佳推荐。 |
| 为什么下载既写事件又更新计数？ | 明细事实 + 汇总冗余 | `1143-1150`、`1340-1348` | `courseResources.service.ts:396-408` | 事件用于统计和审计，计数用于快速排序展示，二者在一个事务中维护。 |

## 平台基础

| 老师可能问法 | 你要回答的核心点 | Final DDL 位置 | 服务层位置 | 一句话答法 |
|---|---|---|---|---|
| 用户资料和登录身份怎么设计？ | `profiles.id` 一对一扩展 `auth.users.id` | `240-270`、`617-686` | `rbac.service.ts` | 认证身份和业务资料分离，主键保持一致。 |
| 学号怎么防止重复或非法格式？ | 唯一索引 + `CHECK` | `240-274` | `rbac.service.ts` | `student_id` 必须是 16 位数字且唯一。 |
| 用户多角色、角色多权限怎么建模？ | 两张桥接表 | `302-318` | `rbac.service.ts` | `user_roles` 和 `role_permissions` 用复合主键表达多对多。 |
| 部门树为什么有闭包表？ | 高效查询全部子部门 | `151-183` | `dataPermission.service.ts` | `parent_id` 表达直接关系，`department_closure` 表达祖先后代可达关系。 |
| 部门树怎么防环？ | 更新父节点前触发器检查 | `492-525` | `dataPermission.service.ts` | 禁止把部门移动到自身子树下。 |
| 数据范围模块名怎么防止乱写？ | `app_modules` + `data_scope_modules` + 外键 | `330-377` | `dataPermission.service.ts` | `role_data_scopes.module` 不再是自由文本。 |
| 自定义数据范围明细怎么依附主配置？ | `(role_id,module)` 复合外键 | `389-399` | `dataPermission.service.ts:203-225` | 部门明细不能脱离角色模块范围主记录存在。 |
| 审计日志为什么不能改？ | append-only 触发器 | `407-456` | `audit.service.ts` | 审计日志是历史事实，禁止 `UPDATE/DELETE`。 |
| 审计为什么不对 `actor_user_id` 建强外键？ | 历史真实性优先 | `407-442` | `audit.service.ts:27-55` | 用户后续删除或脱敏不应破坏审计历史，所以用弱引用加快照。 |

