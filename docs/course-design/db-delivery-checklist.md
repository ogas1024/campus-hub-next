# 数据库课程设计补强检查表

## 1. 编写目的

这份清单用于回答两个最现实的问题：

- 现在数据库课程设计还缺什么
- 这些点是否已经落实到文件，还是还停留在口头结论

它不替代 `teacher-db-checklist.md` 和 `module-db-health-check.md`，而是更聚焦于“最终交稿前必须补齐的数据库课设关键项”。

## 2. 术语口径

- 本课题应使用“函数依赖”这一术语，而不是“关系依赖”
- 本轮答辩重点通常是：
  - 候选键
  - 主属性 / 非主属性
  - 部分依赖
  - 传递依赖
  - 3NF / BCNF
- 多值依赖、连接依赖通常不是本项目的主答辩重点，除非老师继续追问 4NF / 5NF

## 3. 当前补强项总表

| 项目 | 当前状态 | 已有材料 | 仍需补强 |
|------|----------|----------|----------|
| 候选键 | 已基本落实 | `docs/report/overview/relation-schemas.md`、各模块报告 | 需在正式报告里更集中地解释“哪些是业务候选键，哪些只是物理唯一性” |
| 主属性 / 非主属性 | 已落实到支撑文档 | `docs/course-design/normalization-and-integrity.md` | 下一步是在最终正文中挑 2 到 3 个核心关系集中表达 |
| 函数依赖 | 已落实到支撑文档 | `docs/course-design/normalization-and-integrity.md`、`docs/report/modules/course-resources.md` | 下一步是在最终正文中收束成更正式的函数依赖列表 |
| 概念结构设计 | 已落实 | `docs/report/overview/conceptual-structure-and-er.md` | 还需在最终正文中与逻辑设计衔接 |
| 逻辑结构设计 | 已落实 | `docs/report/overview/relation-schemas.md`、模块报告 | 建议把“关系模式 + 候选键 + 函数依赖 + 范式判断”收束成正式成稿 |
| 物理设计 | 已落实 | `docs/report/database/physical-design.md` | 继续保持与最新迁移/Schema 同步即可 |
| 测试与验证 | 已落实 | `docs/report/database/constraint-validation-and-tests.md` | 后续进入正式成稿时再按需要补截图与最终排版 |
| 概念 -> 逻辑 -> 物理 -> 测试主线 | 已有但分散 | `requirements-analysis/11-需求到数据库设计跟踪矩阵.md`、`docs/course-design/report-outline.md` | 还需在最终提交正文中串成连续叙述 |
| 索引设计依据 | 已落实 | `docs/report/database/physical-design.md`、`requirements-analysis/08-非功能需求.md` | 还可补“某条索引具体服务哪条 SQL”这种答辩表达 |
| 删除策略 | 已落实 | `docs/report/overview/relation-schemas.md`、`docs/report/database/physical-design.md` | 需要在正文里更集中地展示 `CASCADE / RESTRICT / SET NULL` 的业务依据 |
| 数据字典 | 已落实 | `docs/report/overview/data-dictionary.md` | 可直接进入正文，但仍需注意是否与最终库结构完全同步 |
| 典型 SQL | 已落实 | `docs/report/database/typical-sql-and-transactions.md` | 还可补“这条 SQL 受哪条索引支持”的对应关系 |
| 角色 / 权限 / 数据范围 | 已落实，而且较强 | `docs/report/modules/platform-core.md`、`docs/requirements/data-permission.md` | 重点转为在正文中解释模块字典、能力表与弱引用审计取舍 |
| 规则是否真正落库 | 主线已基本落实 | `docs/report/database/constraint-validation-and-tests.md` | 后续重点不再是继续补代码，而是把“已落库事实”写进最终正文 |

## 4. 当前最值得优先补强的“成稿”项

### 4.1 功能房预约核心规则已落库

- 当前状态：
  - 时间冲突已由 `EXCLUDE USING gist` 落库
  - 申请人与参与人一致性、最少 3 人已由延迟约束触发器落库
  - 状态一致性 `CHECK` 已落库
- 当前重点：
  - 在正文中把“事务协同 + 数据库硬约束”的关系讲清楚
  - 只把 `facility_bans` 的自然过期语义保留为真实边界

### 4.2 课程资源受控冗余与状态一致性已落库

- 当前状态：
  - `course_resources.major_id` 与 `course_id` 一致性已由复合外键落库
  - `course_resource_score_events.major_id/user_id` 一致性已由复合外键落库
  - 状态一致性 `CHECK`、`best_by` 外键、published-only best 触发器均已落库
- 当前重点：
  - 在正文中把“必要冗余 + 数据库锁定一致性”的逻辑解释清楚

### 4.3 平台基础领域完整性已落库

- 当前状态：
  - `app_modules` / `data_scope_modules` / `role_data_scopes.module` 已形成“模块字典 + 能力表 + 外键”结构
  - `audit_logs.actor_name` 与 `actor_roles` 结构检查已落库
- 当前重点：
  - 在正文中解释为什么 `audit_logs.actor_user_id` 仍保留弱引用

### 4.4 真正还需要继续补强的是最终成稿表达

- 当前状态：
  - A1 和主要 A2 报告文档已经同步到当前数据库事实
  - 剩余工作集中在正式正文串联、术语收束、函数依赖与候选键解释
- 推荐方向：
  - 继续把“概念结构 -> 逻辑结构 -> 物理设计 -> 测试验证”串成连续叙述
  - 在最终正文中单独组织“函数依赖 / 主属性 / 非主属性 / 3NF”表达

## 5. 最终正文建议最少覆盖的数据库点

最终提交版正文建议至少显式覆盖下面这些数据库课程关键词：

1. 需求分析与数据需求分析
2. 概念结构设计与 E-R 图
3. 关系模式、主键、外键、候选键
4. 函数依赖、主属性 / 非主属性、3NF / BCNF
5. 完整性约束
6. 索引设计依据与删除策略
7. 触发器、数据库函数、审计表
8. 典型 SQL、事务设计与并发控制
9. 约束失败样例与“哪些规则已真正落库”

## 6. 一句话结论

当前材料已经足以支撑一份“数据库主线明确、核心规则已落库”的课程设计；接下来最值得继续补强的是：

- 函数依赖与候选键的学院派表达
- 从概念结构到测试验证的连续主线
- 正式提交版正文的收束与排版
