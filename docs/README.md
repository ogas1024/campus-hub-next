# Campus Hub 文档中心

本仓库当前服务于《数据库原理及应用》课程设计阶段。题目名称保持为“校园生活平台”，但本轮文档与改进工作只聚焦数据库主线。

## 当前聚焦

- 平台基础：身份与鉴权、组织结构、RBAC、数据范围、审计日志
- 核心业务：功能房预约、课程资源分享
- 可选扩展：数字图书馆
- 暂不作为本轮主线：通知公告、问卷、投票、失物招领、材料收集等历史模块

## 文档结构

- `course-design/`
  - 课程设计总览、范围说明、报告组织建议
- `requirements/`
  - 当前仍保留并继续维护的模块级工程需求文档
- `api/`
  - 与当前主线模块对应的接口契约
- `report/`
  - 模块报告与课程设计报告支撑材料
- `ops/`
  - 运行、验收和权限校验相关文档
- `_archive/`
  - 已退出当前主线但需要保留的历史文档

## 快速导航

- 课程设计入口：`docs/course-design/README.md`
- 正式需求分析入口：`requirements-analysis/README.md`
- 正式需求分析稿：`requirements-analysis/10-正式需求分析稿.md`
- 报告材料入口：`docs/report/README.md`
- 正式报告正文说明：`docs/report/manuscript/README.md`
- 概念结构设计与 ER 图：`docs/report/overview/conceptual-structure-and-er.md`
- 总体关系模式总表：`docs/report/overview/relation-schemas.md`
- 核心数据字典：`docs/report/overview/data-dictionary.md`
- 物理设计说明：`docs/report/database/physical-design.md`
- 典型 SQL 与事务：`docs/report/database/typical-sql-and-transactions.md`
- 约束验证与测试：`docs/report/database/constraint-validation-and-tests.md`
- 范围说明：`docs/course-design/scope.md`
- 报告组织：`docs/course-design/report-outline.md`
- 平台基础报告：`docs/report/modules/platform-core.md`
- 功能房预约报告：`docs/report/modules/facility-reservation.md`
- 课程资源报告：`docs/report/modules/course-resources.md`
- 数字图书馆报告：`docs/report/modules/library.md`

## 维护原则

- 本轮正式需求分析优先沉淀到 `requirements-analysis/`
- 课程设计总览与答辩口径优先沉淀到 `docs/course-design/`
- 模块级工程需求与接口文档继续保留在 `docs/requirements/` 与 `docs/api/`
- 若某文档已经脱离本轮范围，就移出当前入口并归档到 `docs/_archive/`
