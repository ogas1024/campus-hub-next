# 数据库约束落地 TODO

## 1. 说明

本文件用于跟踪本轮“数据库课程设计增强”相关代码改动，重点记录：

- 哪些规则准备下沉到数据库层
- 需要修改哪些文件
- 具体修改到哪个函数 / 迁移 / schema 位置
- 当前是否已经完成

状态约定：

- `todo`
- `in_progress`
- `done`
- `blocked`

## 2. 当前任务

| 任务 | 状态 | 目标规则 | 计划修改位置 | 实际修改位置 |
|------|------|----------|--------------|--------------|
| 功能房时间冲突数据库化 | `done` | 同一房间 `pending/approved` 预约不可重叠 | `packages/db/migrations/0012_*.sql`、`packages/db/src/schema/facilities.ts`、`lib/modules/facilities/facilities.service.ts` | `packages/db/migrations/0012_course_design_constraints.sql:8-18` 新增 `EXCLUDE USING gist`；`packages/db/src/schema/facilities.ts:66-105` 为 `facilityReservations` 补 `activeTimeIdx` 与显式外键；`lib/modules/facilities/facilities.service.ts:31-56` 新增 `translateFacilityWriteError`，并在 `createMyReservation`(`376-466`) / `updateMyReservation`(`469-567`) 映射数据库冲突 |
| 功能房申请人与参与人一致性 | `done` | 恰有一个申请人参与记录，且必须等于 `applicant_id` | `packages/db/migrations/0012_*.sql`、`packages/db/src/schema/facilities.ts`、`lib/modules/facilities/facilities.service.ts` | `packages/db/migrations/0012_course_design_constraints.sql:20-108` 新增 `facility_validate_reservation_participants()` 与两个延迟约束触发器；`packages/db/src/schema/facilities.ts:107-126` 补 `facility_reservation_participants_applicant_uq` 与参与人外键；`lib/modules/facilities/facilities.service.ts:31-56` 映射 `facility_reservation_participants_applicant_*` 约束错误 |
| 功能房参与人数下限 | `done` | 每条预约参与人数不少于 3 人 | `packages/db/migrations/0012_*.sql`、`lib/modules/facilities/facilities.service.ts` | `packages/db/migrations/0012_course_design_constraints.sql:59-72` 在触发器函数中校验最少 3 人；`lib/modules/facilities/facilities.service.ts:43-52` 将 `facility_reservation_participants_min_count_chk` 转成业务友好提示 |
| 课程资源 `major_id` 一致性 | `done` | `course_resources.major_id` 与 `course_id` 一致 | `packages/db/migrations/0012_*.sql`、`packages/db/src/schema/courseResources.ts` | `packages/db/migrations/0012_course_design_constraints.sql:110-147` 先回填历史数据，再补 `courses_id_major_id_uq`、`course_resources_id_major_id_uq`、`course_resources_course_major_fk`；`packages/db/src/schema/courseResources.ts:58-150` 补复合唯一键、复合外键、显式用户外键 |
| 积分事件 `major_id` 一致性 | `done` | `course_resource_score_events.major_id` 与 `resource_id` 一致 | `packages/db/migrations/0012_*.sql`、`packages/db/src/schema/courseResources.ts` | `packages/db/migrations/0012_course_design_constraints.sql:118-158` 回填 `course_resource_score_events.major_id` 并补 `course_resource_score_events_resource_major_fk`；`packages/db/src/schema/courseResources.ts:188-219` 对齐 `courseResourceScoreEvents.resourceMajorFk` 与相关索引 |
| 课程资源状态一致性 `CHECK` | `done` | `status` 与 `submitted_at/reviewed_at/published_at/unpublished_at` 组合一致 | `packages/db/migrations/0012_*.sql`、`packages/db/src/schema/courseResources.ts` | `packages/db/migrations/0012_course_design_constraints.sql:170-219` 新增 `course_resources_status_consistency_chk`；`lib/modules/course-resources/courseResources.service.ts:46-82` 映射状态/字段组合错误；`lib/modules/course-resources/courseResources.service.ts:1026-1056` 在 `submitMyResource` 提交前清空 `publishedAt/unpublishedAt` 以满足新约束 |
| `course_resource_bests.best_by` 外键 | `done` | 最佳推荐设置人建立显式物理外键 | `packages/db/migrations/0012_*.sql`、`packages/db/src/schema/courseResources.ts` | `packages/db/migrations/0012_course_design_constraints.sql:160-168` 新增 `course_resource_bests_best_by_fk`；`packages/db/src/schema/courseResources.ts:152-167` 为 `courseResourceBests.bestBy` 补显式外键 |
| 积分事件“归属用户”数据库化 | `done` | `course_resource_score_events.user_id` 必须等于 `course_resources.created_by` | `packages/db/migrations/0013_*.sql`、`packages/db/src/schema/courseResources.ts`、`lib/modules/course-resources/courseResources.service.ts` | `packages/db/migrations/0013_course_resource_author_and_best_constraints.sql:5-29` 回填历史 `user_id`，并新增 `course_resources_id_created_by_uq` 与 `course_resource_score_events_resource_user_fk`；`packages/db/src/schema/courseResources.ts:135-136` / `219-225` 同步 `idCreatedByUq` 与 `resourceUserFk`；`lib/modules/course-resources/courseResources.service.ts:60-72` 映射新复合外键错误 |
| 最佳推荐仅允许作用于已发布资源 | `done` | `course_resource_bests.resource_id` 对应资源必须为 `published`，且资源下架后自动撤销最佳 | `packages/db/migrations/0013_*.sql`、`lib/modules/course-resources/courseResources.service.ts` | `packages/db/migrations/0013_course_resource_author_and_best_constraints.sql:31-95` 清理历史脏数据，并新增 `course_resource_best_requires_published()`、`course_resource_drop_best_when_not_published()` 及两个触发器；`lib/modules/course-resources/courseResources.service.ts:75-84` 映射 `course_resource_bests_resource_published_chk`；`lib/modules/course-resources/courseResources.service.ts:1978-2040` 为 `bestConsoleResource()` 补数据库异常翻译与失败审计 |
| 功能房预约状态字段一致性继续强化 | `done` | `reviewed_by/reviewed_at/reject_reason/cancelled_by/cancelled_at` 必须与 `status` 保持一致，且 `cancelled` 可保留既有审核痕迹 | `packages/db/migrations/0014_*.sql`、`lib/modules/facilities/facilities.service.ts` | `packages/db/migrations/0014_facility_reservation_status_consistency.sql:5-78` 先清理安全脏数据，再用 `facility_reservations_status_consistency_chk` 约束四种状态；`lib/modules/facilities/facilities.service.ts:31-64` 映射 `facility_reservations_status_consistency_chk` / `facility_reservations_time_chk`；`lib/modules/facilities/facilities.service.ts:579-626`、`1233-1276`、`1279-1326` 为取消/通过/驳回补数据库异常翻译与失败审计 |
| 模块字典与数据权限模块能力表 | `done` | `module` 主数据独立建模；`role_data_scopes` 仅允许引用支持数据权限的模块；`collect_tasks` 复用模块字典 | `packages/db/migrations/0015_*.sql`、`packages/db/src/schema/modules.ts`、`packages/db/src/schema/dataPermission.ts`、`packages/db/src/schema/materials.ts`、`lib/modules/data-permission/dataPermission.service.ts` | `packages/db/migrations/0015_module_dictionary_and_data_scope_fks.sql:7-131` 新增 `app_modules` / `data_scope_modules`、种子数据、迁移前脏数据检查、`role_data_scopes_module_fk` 与条件化 `collect_tasks_module_fk`；`packages/db/src/schema/modules.ts:3-34` 新增模块字典 schema；`packages/db/src/schema/dataPermission.ts:16-64` 为 `role_data_scopes` / `role_data_scope_departments` 显式补 FK；`packages/db/src/schema/materials.ts:24-63` 为 `collect_tasks.module` 对齐字典外键；`lib/modules/data-permission/dataPermission.service.ts:23-106` / `108-168` / `201-245` 新增模块存在性校验、错误翻译与按模块字典排序；`lib/modules/data-permission/dataPermission.schemas.ts:5-10` 补 `module` 格式约束 |
| 审计日志引用策略定稿 | `done` | `audit_logs.actor_user_id` 保留弱引用；补 `actor_name` 快照、JSON 结构约束与数据库注释，形成“历史真实性优先”的正式设计 | `packages/db/migrations/0016_*.sql`、`packages/db/src/schema/audit.ts`、`lib/modules/audit/audit.service.ts`、`lib/api/audit.ts`、审计列表/详情页 | `packages/db/migrations/0016_audit_actor_snapshot_strategy.sql:1-44` 新增 `actor_name` 回填、`audit_logs_actor_roles_object_chk` 与 `COMMENT ON`；`packages/db/src/schema/audit.ts:6-28` 对齐 `actorName` 列；`lib/modules/audit/audit.service.ts:27-165` 新增 `getActorName()`，并在 `writeAuditLog()` / `listAuditLogs()` / `getAuditLogDetail()` 写入和返回姓名快照；`lib/api/audit.ts:3-30` 增补 `actorName` 类型；`app/(console)/console/audit/page.tsx:122-279`、`app/(console)/console/audit/[id]/page.tsx:45-123` 将姓名快照接入检索与展示 |
| Node 环境下补类型检查 | `done` | 完成 `tsc --noEmit`，关闭“仅数据库实库通过、但未类型验证”的缺口 | 本地开发环境 / CI | 2026-04-22 已在项目根目录执行 `pnpm install` 与 `pnpm exec tsc --noEmit`，类型检查通过；说明此前的环境阻塞已解除 |
| git 复核与文档回写 | `done` | 使用 `git status/diff` 复核本轮改动 | `docs/course-design/db-implementation-todo.md`、相关报告文档 | 已执行 `git status --short -- ...` 与 `git diff --stat -- ...` 复核本轮改动；当前代码落点已回写到本文件。类型检查结果已单独记录。 |
| 管理后台入口降载 | `done` | 避免先进入重聚合工作台；工作台首页改为轻量模式，减少后台首屏卡顿 | `lib/navigation/consoleLanding.ts`、`app/(portal)/layout.tsx`、`components/layout/PortalShell.tsx`、`app/page.tsx`、`app/(console)/console/page.tsx`、`app/(console)/console/workbench/page.tsx`、`components/console/workbench/WorkbenchClient.tsx` | 新增 `lib/navigation/consoleLanding.ts` 统一解析后台落点；Portal 顶栏“管理后台”与 `/console` 首页改为直接落到更轻的可访问模块（优先 `users`）；`app/(console)/console/workbench/page.tsx` 不再首屏同步聚合所有模块统计，改为仅加载快捷入口；`components/console/workbench/WorkbenchClient.tsx` 明确展示“轻量模式 / 去数据概览”说明 |
| 后台数据权限与用户页性能优化 | `done` | 减少后台列表页的重复范围解析与串行数据库读取，优先优化 `/console/users` | `lib/modules/data-permission/dataPermission.service.ts`、`lib/modules/iam/users.service.ts`、`app/(console)/console/users/page.tsx` | `resolveMergedScopeForUser()` 已改为按 `userId + module` 做请求级缓存；`listConsoleUsers()` 中总数与分页列表改为并行查询；`app/(console)/console/users/page.tsx` 将 `requirePerm()` 与 `searchParams` 并行等待，收窄后台用户页的首屏等待链 |
| 后台权限判断去重 | `done` | 避免布局/入口/分析页/用户页反复读取同一批权限，降低 console 导航 pending 风险 | `lib/auth/permissions.ts`、`lib/navigation/consoleLanding.ts`、`app/(console)/console/layout.tsx`、`lib/workbench/context.ts`、`app/(console)/console/workbench/analytics/page.tsx`、`app/screen/workbench/analytics/page.tsx`、`app/(console)/console/users/page.tsx` | `lib/auth/permissions.ts` 新增 `getPermissionChecker()`，一次加载用户权限集合后在内存内完成 `hasPerm/hasAnyPerm` 判断；`consoleLanding`、`console layout`、`workbench context`、后台分析页与用户页改为复用该 checker，避免单次导航中重复触发多轮权限查询 |
| 报告同步第一批：全局口径与平台基础 | `done` | 让报告中的平台基础/全局关系模式/数据字典追平 `0012`-`0016` 已落地事实 | `docs/report/overview/relation-schemas.md`、`docs/report/overview/data-dictionary.md`、`docs/report/modules/platform-core.md`、`docs/course-design/report-sync-checklist.md` | `docs/report/overview/relation-schemas.md`：补 `app_modules` / `data_scope_modules`、更新 `role_data_scopes`、`audit_logs`、功能房参与人一致性、课程资源复合外键与 published-only best 口径；`docs/report/overview/data-dictionary.md`：新增两张平台基础表的数据字典，补 `audit_logs.actor_name`，更新 `role_data_scopes.module`、`course_resources` / `course_resource_bests` / `course_resource_score_events` 约束说明；`docs/report/modules/platform-core.md`：补模块字典与能力表到概念结构、关系模式、完整性、亮点与边界章节；`docs/course-design/report-sync-checklist.md`：将上述三份文档状态改为 `done` |
| 报告同步第二批：核心业务模块与验证总表 | `done` | 让功能房、课程资源、约束验证总表追平 `0012`-`0016` 已落地事实 | `docs/report/modules/facility-reservation.md`、`docs/report/modules/course-resources.md`、`docs/report/database/constraint-validation-and-tests.md`、`docs/course-design/report-sync-checklist.md` | `docs/report/modules/facility-reservation.md`：把时间冲突、参与人一致性、最少人数与状态一致性改写为“已落库亮点”，并把 `facility_bans` 自然过期语义保留为真实边界；`docs/report/modules/course-resources.md`：补 `best_by` 外键、状态一致性、published-only best、作者/专业复合外键与受控冗余解释；`docs/report/database/constraint-validation-and-tests.md`：补 `0013`-`0016` 实库验证记录，把旧的“未落库/主要靠服务层”改成“已落库规则总表 + 服务层协同与设计取舍”；`docs/course-design/report-sync-checklist.md`：将上述三份文档状态改为 `done` |
| 报告同步第三批：设计层与支撑清单 | `done` | 让物理设计、典型 SQL/事务、概念 ER 与课程设计支撑清单追平 `0012`-`0016` 已落地事实 | `docs/report/database/physical-design.md`、`docs/report/database/typical-sql-and-transactions.md`、`docs/report/overview/conceptual-structure-and-er.md`、`docs/course-design/module-db-health-check.md`、`docs/course-design/db-delivery-checklist.md`、`docs/course-design/report-sync-checklist.md` | `docs/report/database/physical-design.md`：补模块字典/能力表、审计快照、功能房 `EXCLUDE` 与延迟约束触发器、课程资源复合外键/状态一致性/published-only best 的物理设计表达；`docs/report/database/typical-sql-and-transactions.md`：把事务样例和并发控制总结改写为“事务 + 数据库硬约束协同”，并修正数据范围模块示例与最佳推荐约束说明；`docs/report/overview/conceptual-structure-and-er.md`：补 `app_modules` / `data_scope_modules`、`audit_logs.actor_name`、`course_resource_bests.best_by` 关系与受控冗余说明；`docs/course-design/module-db-health-check.md` 与 `docs/course-design/db-delivery-checklist.md`：把旧的“当前薄弱点/关键短板”改写为“已解决问题 + 真实剩余边界 + 正式成稿重点”；`docs/course-design/report-sync-checklist.md`：将上述五份文档状态改为 `done` |
| 理论表达补强：规范化与函数依赖 | `done` | 让“候选键 / 主属性 / 非主属性 / 函数依赖 / 3NF”说明与当前已落地数据库事实保持一致 | `docs/course-design/normalization-and-integrity.md`、`docs/course-design/db-delivery-checklist.md` | `docs/course-design/normalization-and-integrity.md`：补 `audit_logs.actor_name`、把功能房/课程资源的“已落库约束”与“受控冗余已由复合外键锁定”写进范式解释；`docs/course-design/db-delivery-checklist.md`：把“主属性 / 非主属性”“函数依赖”从“已有但未成稿”更新为“已落实到支撑文档” |
| 正式报告正文收束：提交版初稿 | `done` | 把已同步完成的数据库材料整合为一份可继续打磨的提交版正文，显式覆盖“概念结构 -> 逻辑结构 -> 物理设计 -> 测试验证”主线以及候选键 / 函数依赖 / 范式表达 | `docs/report/manuscript/校园生活平台数据库课程设计报告.md`、`docs/report/manuscript/README.md` | `docs/report/manuscript/校园生活平台数据库课程设计报告.md`：新增合并版正文初稿，覆盖课题概述、需求分析、概念结构、关系模式、候选键/主属性/非主属性、函数依赖、3NF/BCNF、完整性约束、物理设计、典型 SQL、事务并发、测试结果与真实边界；`docs/report/manuscript/README.md`：把正文目录从“仅说明文件”更新为“已存在合并版初稿 + 后续拆分建议” |
| 封板修正：课程资源状态流转 compare-and-set | `done` | 避免课程资源在审核通过/驳回/下架/提交审核时出现“先读状态、后按 id 覆盖更新”的竞态窗口，确保状态流转与并发控制口径一致 | `lib/modules/course-resources/courseResources.service.ts`、`docs/course-design/db-implementation-todo.md` | `lib/modules/course-resources/courseResources.service.ts`：为 `submitMyResource`(`1032-1066`)、`unpublishMyResource`(`1070-1083`)、`approveConsoleResource`(`1778-1868`)、`rejectConsoleResource`(`1885-1926`) 与 `offlineConsoleResource`(`1950-1989`) 增加基于旧状态的 `WHERE` 条件和 `returning` 检查；对 `offlineConsoleResource` 补失败审计，避免并发场景下静默覆盖旧状态 |
| Supabase 最终封板 smoke test | `done` | 在真实 Supabase 项目上以事务回滚方式复核主线约束与设计取舍，确认代码、迁移和实库行为一致 | `Supabase MCP`、`docs/course-design/db-implementation-todo.md` | 已在真实项目中验证三组主线 smoke test：1) 功能房 `EXCLUDE`、参与人数下限、申请人一致性与状态一致性；2) 课程资源 `course_resources_course_major_fk`、`course_resources_status_consistency_chk`、`course_resource_score_events_resource_user_fk`、published-only best 与自动撤销；3) 平台基础 `role_data_scopes_module_fk`、`audit_logs_actor_roles_object_chk` 与 `audit_logs.actor_user_id` 弱引用策略。全部通过，且测试采用 `begin ... rollback` 未残留数据 |
| 全量环境收敛：历史模块迁移 + Storage + 本地运行入口 | `blocked` | 让当前 Supabase 项目从“数据库课设主线环境”收敛到“完整仓库可运行环境”，并补齐 `.env.local` / `.env.example` / 全量迁移顺序说明 | `packages/db/migrations/0017_*.sql`、`README.md`、`packages/db/README.md`、`.env.example`、`.env.local`、`docs/course-design/db-implementation-todo.md` | `packages/db/migrations/0017_collect_tasks_module_fk_backfill.sql`：补“先 0015 后 0008”环境的 `collect_tasks_module_fk`；`README.md` / `packages/db/README.md`：将完整运行顺序修正为 `0001~0017`；`.env.example`：新增可提交模板；`.env.local`：已预填 Supabase URL/anon key，并标注 `SUPABASE_SERVICE_ROLE_KEY` / `DATABASE_URL` 的 Dashboard 取值位置；真实 Supabase 项目已完成 `0007~0011`、`0017` 与 7 个 bucket 创建，并确认 `collect_tasks_module_fk` 已存在；当前仅剩 MCP 无法读取的两个私密值需要从 Dashboard 填入 |

## 3. 更新记录

- 初始建档：创建本文件并确认本轮优先改动范围。
- 已落第一批数据库增强：设施预约的时间冲突/参与人一致性/最少人数已下沉到数据库层；课程资源的 `major_id` 受控冗余、状态一致性、`best_by` 外键已下沉到数据库层。
- 已完成 git 复核：当前相关文件状态为 `M lib/modules/course-resources/courseResources.service.ts`、`M lib/modules/facilities/facilities.service.ts`、`M packages/db/src/schema/courseResources.ts`、`M packages/db/src/schema/facilities.ts`、`?? packages/db/migrations/0012_course_design_constraints.sql`、`?? docs/course-design/db-implementation-todo.md`。
- 2026-04-22 环境阻塞已解除：已成功执行 `node -v`、`pnpm -v`、`pnpm install` 与 `pnpm exec tsc --noEmit`，当前代码改动通过 TypeScript 类型检查。
- 2026-04-21 已完成 Supabase 实库验证：在空项目 `campus-hub-next` 中成功执行 `0001`、`0002`、`0003`、`0004`、`0005`、`0006`、`0012` 迁移，并验证通过以下规则：
  - 功能房时间冲突排斥约束
  - 功能房参与人数下限
  - 功能房申请人与参与人一致性
  - `course_resources` 的 `major_id` / `course_id` 复合外键一致性
  - `course_resource_score_events` 的 `major_id` / `resource_id` 复合外键一致性
  - 课程资源状态一致性 `CHECK`
  - `course_resource_bests.best_by` 外键
- 2026-04-21 已完成第二批课程资源数据库增强：新增 `0013_course_resource_author_and_best_constraints.sql`，并在 Supabase 实库验证通过以下规则：
  - `course_resource_score_events.user_id` 错绑他人时会被 `course_resource_score_events_resource_user_fk` 拒绝
  - 作者本人插入积分事件可以成功写入
  - 未发布资源设为最佳时会被 `course_resource_bests_resource_published_chk` 拒绝
  - 已发布资源下架后，其 `course_resource_bests` 记录会被触发器自动删除
- 2026-04-21 已完成第三批功能房数据库增强：新增 `0014_facility_reservation_status_consistency.sql`，并在 Supabase 实库验证通过以下规则：
  - `approved` 预约若缺少 `reviewed_by` / `reviewed_at`，会被 `facility_reservations_status_consistency_chk` 拒绝
  - `pending` 预约若提前写入取消痕迹，也会被 `facility_reservations_status_consistency_chk` 拒绝
  - `rejected` 预约可以保留完整审核信息与驳回原因
  - `cancelled` 预约可以保留“先审核通过、后取消”的审核痕迹，同时要求必须存在 `cancelled_by` / `cancelled_at`
- 2026-04-22 已完成模块字典数据库增强：新增 `0015_module_dictionary_and_data_scope_fks.sql`，并在 Supabase 实库验证通过以下规则：
  - `app_modules` 已落地为模块主数据字典，当前种子数据共 15 条
  - `data_scope_modules` 已落地为“支持数据权限”的模块能力表，当前种子数据共 5 条
  - `role_data_scopes.module` 写入 `resource` 这类“已注册但不支持数据权限”的模块时，会被 `role_data_scopes_module_fk` 拒绝
  - `role_data_scopes.module` 写入 `notice` 这类“已登记到 data_scope_modules”的模块时，可以成功写入
  - `data_scope_modules` 写入不存在于 `app_modules` 的 `ghost` 模块时，会被 `data_scope_modules_module_code_fk` 拒绝
- 2026-04-22 已完成审计日志引用策略定稿：新增 `0016_audit_actor_snapshot_strategy.sql`，并在 Supabase 实库验证通过以下规则：
  - `audit_logs.actor_name` 已落地，且 Drizzle schema / 审计 service / 审计列表与详情页已同步接入
  - `audit_logs_actor_roles_object_chk` 已生效，`actor_roles='[]'::jsonb` 这类非法结构会被数据库拒绝
  - `audit_logs.actor_user_id` 仍保持“弱引用”，数据库侧确认未误加外键；以随机 UUID 写入审计探针在回滚事务中可成功通过
  - `audit_logs` 表与 `actor_user_id` / `actor_name` / `actor_email` / `actor_roles` / `diff` 列注释已写入数据库对象，可直接作为后续答辩口径依据
  - 当前 Supabase 验证项目中的 `audit_logs` 为空表，因此 `actor_name` 回填语句本轮验证的是“空表安全执行”；后续若需要展示历史数据回填效果，可补造一条旧结构样本再复演
- 2026-04-22 已建报告同步清单：新增 `docs/course-design/report-sync-checklist.md`，把正式报告层与支撑/规划层中所有“代码已完成但文档仍停留在旧口径”的位置逐项列出，后续按该清单回写报告。
- 2026-04-22 已完成报告同步第一批：`docs/report/overview/relation-schemas.md`、`docs/report/overview/data-dictionary.md`、`docs/report/modules/platform-core.md` 已与 `0012`-`0016` 迁移和当前 Drizzle schema 对齐；`docs/course-design/report-sync-checklist.md` 中对应条目已回写为 `done`。
- 2026-04-22 已完成报告同步第二批：`docs/report/modules/facility-reservation.md`、`docs/report/modules/course-resources.md`、`docs/report/database/constraint-validation-and-tests.md` 已与 `0012`-`0016` 迁移、当前 Drizzle schema 以及 Supabase 实库验证结论对齐；`docs/course-design/report-sync-checklist.md` 中对应条目已回写为 `done`。
- 2026-04-22 已完成报告同步第三批：`docs/report/database/physical-design.md`、`docs/report/database/typical-sql-and-transactions.md`、`docs/report/overview/conceptual-structure-and-er.md`、`docs/course-design/module-db-health-check.md`、`docs/course-design/db-delivery-checklist.md` 已与 `0012`-`0016` 迁移、当前 Drizzle schema 和既有实库验证口径对齐；`docs/course-design/report-sync-checklist.md` 中对应条目已回写为 `done`。
- 2026-04-22 已补理论表达口径：`docs/course-design/normalization-and-integrity.md` 已与当前数据库事实对齐，功能房/课程资源中原先“待增强”的规则改写为“已落库 + 如何从范式角度解释”；`docs/course-design/db-delivery-checklist.md` 中“主属性 / 非主属性”“函数依赖”已更新为“已落实到支撑文档”。
- 2026-04-22 已开始正式报告正文收束：新增 `docs/report/manuscript/校园生活平台数据库课程设计报告.md` 作为合并版提交初稿，已将概念结构、逻辑结构、物理设计、事务并发、测试验证以及候选键 / 主属性 / 非主属性 / 函数依赖 / 3NF 表达收束到同一正文；`docs/report/manuscript/README.md` 已同步更新当前状态与后续拆分建议。
- 2026-04-22 已完成代码封板修正：`lib/modules/course-resources/courseResources.service.ts` 中课程资源的提交审核、作者下架、审核通过、审核驳回、控制台下架等状态流转已补 compare-and-set 风格的 `WHERE status=...` 条件，避免并发场景下按 `id` 静默覆盖旧状态；其中 `offlineConsoleResource` 还补充了失败审计记录。
- 2026-04-22 已完成 Supabase 最终封板 smoke test：通过 Supabase MCP 连接真实项目 `https://nytgczjjdryocjyjmozn.supabase.co`，确认 `0001`-`0006`、`0012`-`0016` 已全部存在，并以事务回滚方式验证功能房、课程资源、平台基础三组主线约束。过程中额外确认了当前环境存在 `auth.users -> public.handle_new_user()` 触发器与 `audit_logs` append-only 约束，因此最终 smoke test 采用符合真实环境的插入方式和 `rollback` 清理策略；三组测试均通过。
- 2026-04-22 兼容性说明：当前 Supabase 验证项目尚未部署 `collect_tasks` / `0008_materials.sql`，因此 `collect_tasks_module_fk` 已写入迁移与 Drizzle schema，但本轮只验证了“裁剪环境下迁移可安全执行”，尚未在真实 `collect_tasks` 表上做实库正反例验证。
- 2026-04-22 已完成全量 Supabase 环境收敛：在真实项目 `https://nytgczjjdryocjyjmozn.supabase.co` 上补执行 `0007_surveys`、`0008_materials`、`0009_library`、`0010_lostfound`、`0011_votes`、`0017_collect_tasks_module_fk_backfill`，并创建 `avatars`、`course-resources`、`library-books`、`notice-attachments`、`lostfound`、`material-templates`、`material-submissions` 共 7 个 bucket；数据库侧已确认 `collect_tasks_module_fk` 存在，历史模块表已全部落地。当前唯一剩余阻塞是 MCP 无法读取 `SUPABASE_SERVICE_ROLE_KEY` 与 `DATABASE_URL`，因此 `.env.local` 只能预填 URL/anon key 并保留占位。
- 2026-04-22 已补 demo 脚本失败快照与连接提示：`scripts/demo-data.mjs` 中 `seed/reset` 的数据库连接改为显式 `connect_timeout=5` / `idle_timeout=5`，避免 `pnpm demo:seed` 在错误 `DATABASE_URL` 下长期卡在“预检”；若检测到当前连接串是 Supabase 直连地址 `db.<project>.supabase.co:5432` 且出现 `ENOTFOUND/ETIMEDOUT` 等网络错误，会明确提示改用 Supabase pooler 连接串（推荐 `Transaction pooler` + `sslmode=require`）。
- 2026-04-22 已修正 demo 功能房造数与现行数据库约束不一致的问题：`scripts/demo-data.mjs` 中“功能房预约”示例原先存在 1~2 人参与的旧数据口径，会被 `facility_reservation_participants_min_count_chk` 拒绝；现已把 `approved/pending/history` 三条示例预约统一调整为“申请人 + 另外两名参与人”，与当前数据库中“至少 3 人、且申请人恰好 1 个并等于 `applicant_id`”的约束保持一致。
- 2026-04-22 已完成本轮测试数据清理：模块字典验证使用的临时角色 `db_test_role_0015` 已删除，`role_data_scopes` 未残留测试记录。
- 2026-04-22 已处理前端运行时告警第一项：`components/ui/toast.tsx` 中 `useSyncExternalStore(..., getServerSnapshot)` 原先每次返回新数组 `[]`，会在 Next.js 16 / React 19 开发态触发 “The result of getServerSnapshot should be cached to avoid an infinite loop”；现已改为复用稳定的 `EMPTY_TOASTS` 引用，并在清空 toast 时复用同一空快照。
- 2026-04-22 已完成 `TimeoutNegativeWarning` 初判：仓库业务代码中未发现服务端负数 `setTimeout`；当前安装的 `react-dom` server runtime 代码中存在 `setTimeout(..., $RT + 300 - performance.now())` 这一开发态调度逻辑，因此 `ResourcesMajorsPage` 上看到的 `(node) TimeoutNegativeWarning` 更可能属于 Next.js 16.0.10 / React 19.2.1 开发运行时告警，而非本项目页面业务逻辑错误。后续若继续出现，优先考虑升级 Next.js 或切回 `pnpm dev:webpack` 复核。
- 2026-04-23 已收敛共享渲染路径上的后台权限依赖：`app/page.tsx`、`app/(portal)/layout.tsx` 不再在每次前台 SSR 时调用 `resolveConsoleLandingHref(user.id)` 计算后台落点，而是统一只暴露轻量入口 `/console`，把真正的权限分流留在 `app/(console)/console/page.tsx` 内部处理，避免前台首页 / portal layout 被后台权限树查询拖慢甚至级联卡死。
- 2026-04-23 已开始清理 `auth.users` 热路径依赖：新增 `packages/db/migrations/0018_profiles_auth_snapshot.sql`，把 `email / email_confirmed_at / auth_banned_until / auth_deleted_at` 镜像到 `public.profiles` 并通过触发器与 `auth.users` 同步；`lib/auth/session.ts`、`lib/modules/profile/profile.service.ts`、`lib/modules/iam/users.service.ts`、`lib/modules/facilities/facilities.service.ts`、`lib/modules/course-resources/courseResources.service.ts`、`lib/modules/library/library.service.ts`、`lib/modules/lostfound/lostfound.service.ts` 已切换为优先读取 `profiles` 快照，减少对 `auth.users` 的直接 join。
- 2026-04-21 已完成测试数据清理：Supabase 项目中用于课程资源 / 功能房约束验证的测试账号、测试楼房/房间、测试专业/课程/课程资源均已删除。
- 2026-04-21 已新增复现实验文档：`docs/report/database/supabase-reproduction-and-screenshot-checklist.md`，用于后续答辩复做与截图取证。

## 4. 下一批候选改进

| 优先级 | 任务 | 状态 | 目标规则 | 计划修改位置 |
|------|------|------|----------|--------------|
| P1 | 积分事件“归属用户”数据库化 | `done` | `course_resource_score_events.user_id` 必须等于 `course_resources.created_by` | `packages/db/migrations/0013_*.sql`、`packages/db/src/schema/courseResources.ts`、`lib/modules/course-resources/courseResources.service.ts` |
| P1 | 最佳推荐仅允许作用于已发布资源 | `done` | `course_resource_bests.resource_id` 对应资源必须为 `published` | `packages/db/migrations/0013_*.sql`、`lib/modules/course-resources/courseResources.service.ts` |
| P1 | 功能房预约状态字段一致性继续强化 | `done` | 对 `reviewed_by/cancelled_by` 与 `status` 的组合做更严格约束 | `packages/db/migrations/0014_*.sql`、`lib/modules/facilities/facilities.service.ts` |
| P2 | `role_data_scopes.module` 域约束数据库化 | `done` | `module` 不再是自由文本，而是模块字典表 + 外键 | `packages/db/migrations/0015_*.sql`、`packages/db/src/schema/modules.ts`、`packages/db/src/schema/dataPermission.ts`、`packages/db/src/schema/materials.ts`、相关 service |
| P2 | 审计日志引用策略定稿 | `done` | `audit_logs.actor_user_id` 保留弱引用；补 `actor_name` 快照、JSON 结构约束与数据库注释，形成“历史真实性优先”的正式设计 | `packages/db/migrations/0016_*.sql`、`packages/db/src/schema/audit.ts`、`lib/modules/audit/audit.service.ts`、审计页面/API 类型 |
| P3 | Node 环境下补类型检查 | `done` | 完成 `tsc --noEmit`，关闭“仅数据库实库通过、但未类型验证”的缺口 | 本地开发环境 / CI |
| P4 | 正式报告正文二次压缩与答辩版提炼 | `todo` | 在现有合并版正文基础上继续压缩篇幅、统一术语，并整理一版适合答辩口述的“数据库亮点 + 设计取舍”摘要 | `docs/report/manuscript/校园生活平台数据库课程设计报告.md`、`docs/course-design/teacher-db-checklist.md`、相关答辩提纲文档 |
