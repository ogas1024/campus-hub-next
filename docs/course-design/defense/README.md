# 数据库答辩代码导读入口

这组文档的目标不是再背一遍数据库概念，而是帮你在老师追问时能迅速说清楚：

- 这个需求对应哪些表
- 哪些约束在数据库层真正落库
- 哪段代码开启事务、加锁、写入主表和明细表
- 哪些非法行为即使绕过业务流程也会被数据库拒绝
- 哪些地方是有意取舍，而不是“没做完”

## 建议阅读顺序

1. `06-final-ddl-reading-guide.md`
   - 先看这个。它把最终版 DDL 的表、约束、触发器位置收敛成一张答辩地图。
2. `00-question-to-code-map.md`
   - 再看这个。它把老师可能问的问题映射到具体文件和答法。
3. `01-facility-reservation-code-walkthrough.md`
   - 功能房预约是最高优先级。重点看时间冲突、参与人约束、事务和封禁。
4. `02-course-resources-code-walkthrough.md`
   - 重点看资源去重、受控冗余、审核加积分事务、最佳推荐触发器。
5. `03-platform-core-code-walkthrough.md`
   - 重点看 RBAC、部门闭包表、数据范围复合外键、审计 append-only。
6. `04-illegal-data-demo-sql.md`
   - 用来准备现场演示或口头说明“数据库自己会拒绝非法数据”。
7. `05-ten-minute-defense-script.md`
   - 答辩 10-15 分钟时的讲解顺序和被追问后的转场话术。

## 核心代码位置

答辩讲“最终数据库设计”时，先看完整收敛版：

| 主题 | 最终版 DDL |
|---|---|
| 平台基础 + 功能房预约 + 课程资源分享 | `packages/db/final-ddl/course-design-final-schema.sql` |

下面这些是答辩时的主证据位置。数据库结构统一指向 final DDL，服务层代码用于说明事务、行锁和业务入口：

| 主题 | 数据库 SQL | 服务层代码 |
|---|---|---|
| 功能房预约表结构 | `packages/db/final-ddl/course-design-final-schema.sql:749-959` | `lib/modules/facilities/facilities.service.ts` |
| 功能房冲突与参与人约束 | `packages/db/final-ddl/course-design-final-schema.sql:811-906`、`966-1066` | `lib/modules/facilities/facilities.service.ts` |
| 功能房状态一致性 | `packages/db/final-ddl/course-design-final-schema.sql:833-895` | `lib/modules/facilities/facilities.service.ts` |
| 课程资源表结构 | `packages/db/final-ddl/course-design-final-schema.sql:1074-1379` | `lib/modules/course-resources/courseResources.service.ts` |
| 课程资源字段组合约束 | `packages/db/final-ddl/course-design-final-schema.sql:1203-1249` | `lib/modules/course-resources/courseResources.service.ts` |
| 课程资源受控冗余 | `packages/db/final-ddl/course-design-final-schema.sql:1195-1201` | `lib/modules/course-resources/courseResources.service.ts` |
| 最佳推荐与作者归属 | `packages/db/final-ddl/course-design-final-schema.sql:1322-1427` | `lib/modules/course-resources/courseResources.service.ts` |
| 平台基础 / RBAC | `packages/db/final-ddl/course-design-final-schema.sql:240-318` | `lib/modules/rbac/rbac.service.ts` |
| 部门闭包表 / 数据范围 / 审计 | `packages/db/final-ddl/course-design-final-schema.sql:151-183`、`330-456` | `lib/modules/data-permission/dataPermission.service.ts`、`lib/modules/audit/audit.service.ts` |
| 模块字典与数据范围模块 | `packages/db/final-ddl/course-design-final-schema.sql:330-399` | `lib/modules/data-permission/dataPermission.service.ts` |
| 审计快照策略 | `packages/db/final-ddl/course-design-final-schema.sql:407-456` | `lib/modules/audit/audit.service.ts` |

历史 `packages/db/migrations/*.sql` 用于解释“这些约束是如何逐步增强出来的”，不是答辩时查最终表结构的主入口。

## 答辩时的默认口径

遇到任何具体问题，都按这个顺序答：

1. 先说业务规则。
2. 再说关系模式。
3. 再说数据库约束。
4. 再说事务或服务层代码。
5. 最后说边界和取舍。

示例：

> 针对“同一房间不能重复预约”，我的业务规则是同一 `room_id` 的 `pending/approved` 时间段不能重叠；关系模式上由 `facility_reservations(room_id,start_at,end_at,status)` 表达；数据库层用 `EXCLUDE USING gist` 排斥约束兜底；服务层创建预约时在事务内 `FOR UPDATE` 锁房间并做重叠预查；即使并发绕过预查，数据库仍会拒绝最终冲突写入。
