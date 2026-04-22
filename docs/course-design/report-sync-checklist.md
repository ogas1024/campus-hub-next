# 报告同步清单

## 1. 目的

本清单用于解决一个已经出现的现实问题：

- 数据库代码与 Supabase 实库验证已经推进到 `0012` 到 `0016`
- 但多份报告与支撑文档仍停留在“这些规则还没落库”的旧状态

因此，本文件只负责两件事：

1. 找出哪些文档已经过时
2. 明确每份文档后续应如何同步

说明：

- 本文件暂不直接改正文
- 当前“事实基线”以以下材料为准：
  - `docs/course-design/scope.md`
  - `docs/course-design/db-implementation-todo.md`
  - `packages/db/migrations/0012_course_design_constraints.sql`
  - `packages/db/migrations/0013_course_resource_author_and_best_constraints.sql`
  - `packages/db/migrations/0014_facility_reservation_status_consistency.sql`
  - `packages/db/migrations/0015_module_dictionary_and_data_scope_fks.sql`
  - `packages/db/migrations/0016_audit_actor_snapshot_strategy.sql`

状态约定：

- `todo`
- `in_progress`
- `done`
- `skip`

## 2. 边界提醒

- 本轮主线只覆盖：
  - 平台基础子系统
  - 功能房预约
  - 课程资源分享
  - 数字图书馆仅作为可选扩展
- `材料收集 / collect_tasks` 不属于本轮核心报告主线，不应因为 `0015` 中顺手兼容了 `collect_tasks_module_fk`，就把它升级成正式报告必须展开的重点内容

## 3. 正式报告层必须同步

| 优先级 | 文件 | 当前过时点 | 需要同步的事实 | 建议动作 | 状态 |
|------|------|------------|----------------|----------|------|
| A1 | `docs/report/database/constraint-validation-and-tests.md` | 第 4 节“规则落库情况总表”和第 5 节“当前主要由服务层保证的规则”仍把功能房冲突、参与人数、申请人一致性、`role_data_scopes.module` 域约束、课程资源 `major_id` 一致性、资源状态一致性、`best_by` 外键写成“尚未落库” | 上述规则已经由 `0012` 到 `0016` 落库，并已完成 Supabase 实库验证；审计策略也已定稿为“弱引用 + 快照” | 重写第 2.1、4、5、6 节；补 `0013` 到 `0016` 验证记录；把“未落库清单”改成“已落库规则总表 + 少量真实剩余边界” | `done` |
| A1 | `docs/report/modules/facility-reservation.md` | 第 6.3、7.1、7.2 仍把时间冲突、申请人与参与人一致性、最少 3 人写成未来增强项 | `facility_reservations_room_active_time_excl`、延迟约束触发器、状态一致性 `CHECK` 已落库 | 把“未来增强”改成“已完成亮点”；只保留 `facility_bans` 自然过期语义这类真实剩余边界 | `done` |
| A1 | `docs/report/modules/course-resources.md` | 仍写 `best_by` 无 FK、状态一致性尚未完全落库、`major_id` 一致性仍主要靠服务层 | `best_by` FK、`course_resources` / `score_events` 复合外键、一致性 `CHECK`、published-only best 与自动撤销触发器都已落库 | 重写关系模式、完整性设计、7.x“仍需强化”部分；把受控冗余的解释更新为“已配套数据库一致性机制” | `done` |
| A1 | `docs/report/modules/platform-core.md` | 仍写 `role_data_scopes.module` 为自由文本；审计策略只停留在“无 FK 可能会被追问”的阶段 | `app_modules` / `data_scope_modules` 已落地；`role_data_scopes.module` 已通过能力表 FK 控制；`audit_logs` 已补 `actor_name` 与正式弱引用口径 | 更新概念结构、弱点与亮点章节；把“待加强”改为“已完成设计取舍”；补模块字典与能力表 | `done` |
| A1 | `docs/report/overview/relation-schemas.md` | `role_data_scopes.module` 仍写“自由文本”；`facility_reservation_participants` 仍写“尚未完全保证申请人与 applicant_id 一致”；`course_resource_bests.best_by` 仍写无 FK；`audit_logs` 缺 `actor_name`；缺 `app_modules` / `data_scope_modules` | 实际关系模式已变化，且新增两张平台基础表和一个审计快照字段 | 补两张新表；更新 `role_data_scopes` / `facility_reservation_participants` / `course_resource_bests` / `audit_logs` 的约束说明 | `done` |
| A1 | `docs/report/overview/data-dictionary.md` | 缺 `app_modules`、`data_scope_modules`；`audit_logs` 缺 `actor_name`；`actor_user_id` / `best_by` 口径过时 | 新表、新字段、新 FK、新注释都已存在 | 新增两张表的数据字典；补 `actor_name`；更新 `actor_user_id` 与 `best_by` 说明 | `done` |
| A2 | `docs/report/database/physical-design.md` | 仍把功能房时间冲突、课程资源 `major_id` 一致性、`best_by` FK 写成“尚未完全数据库化” | 这些点已经由 `0012` 到 `0013` 落库 | 把“建议增强”改成“当前已实现”；只留下真实剩余边界，如封禁自然过期语义、审计弱引用为何不建 FK | `done` |
| A2 | `docs/report/database/typical-sql-and-transactions.md` | 第 4.3 仍写“时间冲突尚未使用 `EXCLUDE`”“状态一致性仍主要依赖服务层” | 当前已是“事务控制 + 数据库约束”协同，而不是单纯服务层兜底 | 重写并发控制总结；保留事务价值，但要说明数据库层现在已经形成第二道甚至第一道保护 | `done` |
| A2 | `docs/report/overview/conceptual-structure-and-er.md` | 平台基础 ER 图仍未体现 `app_modules` / `data_scope_modules`；审计结构未体现 `actor_name` 快照 | 平台基础模块现在已多出“模块主数据字典 + 能力表 + 更完整审计快照” | 在平台基础相关 ER 图和说明中补齐新结构，避免概念设计与逻辑/物理设计脱节 | `done` |

## 4. 支撑/规划层建议同步

| 优先级 | 文件 | 当前过时点 | 需要同步的事实 | 建议动作 | 状态 |
|------|------|------------|----------------|----------|------|
| B1 | `docs/course-design/module-db-health-check.md` | 仍把 `role_data_scopes.module`、功能房三条核心规则、课程资源一致性/状态/`best_by` 当作“当前薄弱点” | 这些薄弱点已通过 `0012` 到 `0016` 解决 | 把“当前薄弱点”改成“已解决问题 + 仍剩哪些真实边界” | `done` |
| B1 | `docs/course-design/db-delivery-checklist.md` | 仍把 `module` 域约束、规则落库情况写成“当前最关键短板” | 当前主线 DB 规则下沉工作已经收口 | 把“仍需补强”收缩到报告表达与正式成稿，而不是继续追加数据库代码任务 | `done` |
| B2 | `docs/course-design/db-implementation-todo.md` | 该文件已基本同步，但要继续作为“事实基线”维护 | 代码与验证状态已经是最新 | 不把它改成报告正文；只继续记录“哪些报告文件已同步完成” | `done` |

## 5. 真正还可以保留为“剩余边界”的点

以下内容可以继续在报告中如实保留为“已实现后的真实边界/设计取舍”，不必强行写成“全部完美”：

- `audit_logs.actor_user_id` 仍然没有物理 FK
  - 但现在已经是“有意弱引用 + 快照保留 + 数据库注释”的正式设计，而不是“尚未统一”
- `facility_bans` 当前以 `revoked_at is null` 定义活动封禁
  - “自然过期但未显式撤销”仍可作为一个可解释的小边界
- `collect_tasks_module_fk`
  - 已在迁移中兼容，但因为“材料收集”不在本轮主线范围内，不应占用正式报告主线篇幅
- `audit_logs.actor_name` 回填
  - 当前 Supabase 验证库为空表，因此验证到的是“空表安全执行”；若答辩需要展示历史回填，可单独补造样本

## 6. 推荐同步顺序

建议后续真正开始改报告时按下面顺序推进：

1. `docs/report/overview/relation-schemas.md`（已完成）
2. `docs/report/overview/data-dictionary.md`（已完成）
3. `docs/report/modules/platform-core.md`（已完成）
4. `docs/report/modules/facility-reservation.md`（已完成）
5. `docs/report/modules/course-resources.md`（已完成）
6. `docs/report/database/physical-design.md`（已完成）
7. `docs/report/database/typical-sql-and-transactions.md`（已完成）
8. `docs/report/database/constraint-validation-and-tests.md`（已完成）
9. `docs/course-design/module-db-health-check.md`（已完成）
10. `docs/course-design/db-delivery-checklist.md`（已完成）

这样做的好处是：

- 先统一全局事实口径
- 再改模块正文
- 最后再回写测试与支撑材料

## 7. 一句话结论

当前清单列出的报告同步任务已经完成，下一步应从“事实追平”转向“最终提交版正文收束与答辩表达优化”。
