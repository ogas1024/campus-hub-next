# 三个主线模块的数据库体检清单

本清单从“3NF + 完整性约束 + 物理外键 + 数据库课程答辩友好度”四个角度，检查当前主线模块的数据库设计状态。

## 一、平台基础子系统

### 1. 当前优势

- `profiles`、`user_roles`、`role_permissions`、`user_departments`、`user_positions` 等核心关系都显式使用了物理外键，数据库基础比较扎实。
  - 参考：
    - [0001_baseline.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0001_baseline.sql:76)
    - [0001_baseline.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0001_baseline.sql:96)
    - [0002_infra.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0002_infra.sql:215)
- 部门树采用闭包表建模，并通过触发器维护，属于较强的数据库建模能力展示点。
  - 参考：
    - [0002_infra.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0002_infra.sql:65)
    - [0002_infra.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0002_infra.sql:127)
    - [0002_infra.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0002_infra.sql:159)
- `role_data_scope_departments` 对 `(role_id, module)` 建立了复合外键，这一点很学院派，也适合答辩展示。
  - 参考：[0002_infra.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0002_infra.sql:259)
- `audit_logs` 使用 append-only 设计，并通过触发器禁止 `UPDATE/DELETE`，非常适合作为“数据库对象设计”亮点。
  - 参考：[0002_infra.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0002_infra.sql:273)

### 2. 3NF 体检

- `roles`、`permissions`、`user_roles`、`role_permissions` 基本符合 3NF，没有明显的传递依赖问题。
- `user_departments`、`user_positions` 作为多对多拆分表，设计合理。
- `department_closure` 不是普通业务冗余，而是“为树查询服务的派生关系表”，答辩时应解释为“性能与可查询性优化”，不要把它当成违背规范化的错误。
- `audit_logs.actor_name`、`audit_logs.actor_email`、`audit_logs.actor_roles` 属于“审计快照字段”，也是有意冗余，合理，但必须说明用途是历史保留。

### 3. 已解决问题与剩余边界

- `role_data_scopes.module` 已不再是自由文本，而是通过 `app_modules` / `data_scope_modules` 与 `role_data_scopes_module_fk` 受控。
- `audit_logs.actor_user_id` 仍然没有显式外键，但现在已经是“弱引用 + 姓名/邮箱/角色快照 + 数据库注释”的正式设计取舍，而不是未统一状态。
- `app_config` 走了 `key + jsonb` 的工程化路线，比较实用，但不适合当作关系建模亮点，应尽量弱化。

### 4. 建议改进

- 在报告中强调：
  - `app_modules + data_scope_modules` 属于“模块字典 + 能力表”的可扩展领域建模
  - `audit_logs.actor_user_id` 的弱引用是“历史真实性优先”的正式设计，而不是缺漏
- 报告中把平台基础模块单独作为一章，而不是只当“工程基础设施”

### 5. 老师视角结论

- 这部分整体偏强，是当前项目中最容易拿高分的数据库设计内容之一。
- 只要把“闭包表、复合外键、审计不可改、RBAC 多对多”讲清楚，就很有说服力。

## 二、功能房预约模块

### 1. 当前优势

- 楼房、房间、预约、参与人、封禁均使用了显式物理外键。
  - 参考：
    - [0006_facility_reservations.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0006_facility_reservations.sql:35)
    - [0006_facility_reservations.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0006_facility_reservations.sql:65)
    - [0006_facility_reservations.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0006_facility_reservations.sql:113)
- 已经有很好的 `CHECK` 约束：
  - 房间容量非负
  - `end_at > start_at`
  - 审核/驳回/取消字段与状态一致
  - 封禁撤销时间合法
- `facility_reservation_participants` 使用复合主键，且有“每个预约最多一个申请人”的部分唯一索引。
  - 参考：[0006_facility_reservations.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0006_facility_reservations.sql:112)
- 时间冲突排斥约束、参与人数下限、申请人与参与人一致性都已经下沉到数据库层。
  - 参考：[0012_course_design_constraints.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0012_course_design_constraints.sql:8)
- 状态与审核/取消字段的一致性已经进一步强化。
  - 参考：[0014_facility_reservation_status_consistency.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0014_facility_reservation_status_consistency.sql:36)
- 针对活跃预约建立了部分索引，说明已经考虑物理设计。
  - 参考：[0006_facility_reservations.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0006_facility_reservations.sql:102)

### 2. 3NF 体检

- `facility_buildings`、`facility_rooms`、`facility_reservations`、`facility_bans` 主体上符合 3NF。
- `facility_reservation_participants` 作为预约与用户的多对多拆分表，设计合理。
- 没有明显的“非主属性依赖非主属性”的结构性问题。

### 3. 已解决问题与剩余边界

- “同一房间活跃预约时间段不能重叠”已经由 `facility_reservations_room_active_time_excl` 下沉到数据库层。
- “申请人必须出现在参与人表中、且唯一申请人记录必须对应 `applicant_id`”已经由延迟约束触发器保证。
- “至少 3 名参与人”也已经下沉到数据库层。
- 当前真正剩余的边界是：`facility_bans` 的“有效封禁唯一”与“自然过期但未显式撤销”之间还有细微语义差异。

### 4. 建议改进

- 在报告里重点展示：
  - 时间冲突排斥约束
  - 延迟约束触发器
  - 状态一致性约束
  - 并发场景中“事务 + 数据库硬约束”的协同
- 只把 `facility_bans` 的自然过期语义保留为真实剩余边界，不要再把核心规则写成“尚未落库”

### 5. 老师视角结论

- 这是当前最适合作为“核心业务案例”的模块。
- 这一块现在已经可以直接作为“复杂业务规则落到数据库层”的答辩主案例。

## 三、课程资源分享模块

### 1. 当前优势

- 专业、课程、资源、专业负责人、下载事件、积分事件结构完整，业务层级清楚。
  - 参考：[0004_course_resources.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0004_course_resources.sql:27)
- 物理外键覆盖较好，主业务关系清晰：
  - `courses.major_id -> majors.id`
  - `course_resources.course_id -> courses.id`
  - `major_leads.major_id -> majors.id`
  - 事件表 -> 主体表
- 文件/外链互斥约束已经通过 `CHECK` 明确落库。
  - 参考：[0004_course_resources.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0004_course_resources.sql:120)
- 去重规则已用条件唯一索引体现。
  - 参考：[0004_course_resources.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0004_course_resources.sql:153)
- 积分事件表用唯一约束保证“首次语义”，很适合答辩展示。
  - 参考：[0004_course_resources.sql](/Users/ogas/Code/DB/Project/campus-hub-next/packages/db/migrations/0004_course_resources.sql:189)
- `course_resources.major_id`、`course_resource_score_events.major_id/user_id` 的一致性已经通过复合外键锁定。
- `course_resource_bests.best_by` 外键、资源状态一致性 `CHECK`、published-only best 触发器都已落库。

### 2. 3NF 体检

- `majors`、`major_leads`、`courses` 基本符合 3NF。
- `course_resources` 存在一个较明显的学院派风险点：
  - 同时保存 `major_id` 和 `course_id`
  - 而 `course_id -> major_id`
  - 这会被老师视为潜在传递依赖或不必要冗余
- `course_resource_score_events` 也同时保存 `major_id` 和 `resource_id`
  - 若 `resource_id -> course_resources.major_id`
  - 则这里也有类似冗余问题

### 3. 已解决问题与剩余边界

- `course_resources.major_id` 与 `course_id` 的一致性已经由复合外键保证。
- `course_resource_score_events.major_id` 与 `user_id` 的一致性已经由两组复合外键保证。
- `course_resource_bests.best_by` 已补显式物理外键。
- 资源状态与时间字段之间已经补上数据库层一致性约束。
- 当前真正需要在答辩中解释的，不是“规则还没做完”，而是“为什么保留这些受控冗余，以及数据库如何锁定它们的一致性”。

### 4. 建议改进

- 在报告里明确区分：
  - 主体表
  - 事件事实表
  - 排行榜统计来源
- 明确说明：
  - `major_id` / `user_id` 属于必要冗余
  - 一致性已经由复合外键锁定
  - `download_count` / `last_download_at` 属于面向读性能的汇总冗余

### 5. 老师视角结论

- 这部分业务结构很丰富，但当前最明显的问题也是“工程折中痕迹较重”。
- 这部分现在已经具备“必要冗余有理由、且数据库能锁定一致性”的答辩条件。

## 四、你还没显式提到、但老师很可能在意的点

除了 3NF、完整约束、显式物理外键之外，还建议重点准备这些内容：

### 1. 数据字典

- 每张核心表要有字段说明
- 包括类型、长度、是否可空、默认值、约束、含义

### 2. 删除策略

- 为什么有的表 `CASCADE`
- 为什么有的表 `RESTRICT`
- 为什么有的表 `SET NULL`

### 3. 索引设计依据

- 哪些查询促使你建立联合索引
- 为什么有部分索引
- 哪些索引是为统计而建

### 4. 事务与并发

- 哪些业务必须事务执行
- 是否有并发更新/预约冲突/重复提交问题
- 数据库如何保证一致性

### 5. 视图 / 典型 SQL / 失败样例

- 如果能展示几个典型 SQL，会比只讲接口更有说服力
- 如果能演示插入非法数据被数据库拒绝，效果很好

### 6. “必要冗余”的解释能力

- 并不是所有冗余都错
- 但所有冗余都需要有理由、有边界、有一致性机制

## 五、总体优先级建议

1. 先把平台基础、功能房、课程资源三条主线的报告表达完全同步到已落地数据库事实
2. 再集中补“函数依赖 / 候选键 / 主属性 / 非主属性”的学院派解释
3. 最后再考虑把数字图书馆作为课程资源的同构扩展
