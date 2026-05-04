# 数据库课程设计文档入口

## 课题口径

- 课程设计题目：校园生活平台
- 本轮数据库设计聚焦：
  - 平台基础子系统：身份与鉴权、组织结构、RBAC、数据范围、审计日志
  - 核心业务子系统：功能房预约、课程资源分享
  - 可选扩展：数字图书馆

## 技术路线说明

- 数据库核心：PostgreSQL
- 当前运行环境：兼容 PostgreSQL 的现有工程环境
- 课程设计展示重点：概念模型、关系模式、完整性约束、索引、触发器、事务与复杂查询
- 不作为本轮重点：界面打磨、历史模块扩展、重写一套完整自定义 Auth

## 文档导航

- 正式需求分析目录：`requirements-analysis/README.md`
- 正式需求分析稿：`requirements-analysis/10-正式需求分析稿.md`
- 范围说明：`docs/course-design/scope.md`
- 报告组织：`docs/course-design/report-outline.md`
- 老师视角检查清单：`docs/course-design/teacher-db-checklist.md`
- 答辩模拟问答：`docs/course-design/defense-mock-qa.md`
- 答辩代码导读：`docs/course-design/defense/README.md`
- 答辩最终版 DDL：`packages/db/final-ddl/course-design-final-schema.sql`
- 数据库课设补强检查表：`docs/course-design/db-delivery-checklist.md`
- 三个主线模块体检：`docs/course-design/module-db-health-check.md`
- 补充关注点：`docs/course-design/what-else-matters.md`
- 规范化与完整性说明：`docs/course-design/normalization-and-integrity.md`
- 报告材料入口：`docs/report/README.md`
- 正式报告正文说明：`docs/report/manuscript/README.md`
- 总体关系模式总表：`docs/report/overview/relation-schemas.md`
- 概念结构设计与 ER 图：`docs/report/overview/conceptual-structure-and-er.md`
- 核心数据字典：`docs/report/overview/data-dictionary.md`
- 物理设计说明：`docs/report/database/physical-design.md`
- 典型 SQL 与事务：`docs/report/database/typical-sql-and-transactions.md`
- 约束验证与测试：`docs/report/database/constraint-validation-and-tests.md`

### 平台基础

- 需求：
  - `docs/requirements/auth.md`
  - `docs/requirements/iam.md`
  - `docs/requirements/organization.md`
  - `docs/requirements/data-permission.md`
  - `docs/requirements/audit.md`
  - `docs/requirements/user-management.md`
- API：
  - `docs/api/iam.md`
  - `docs/api/organization.md`
  - `docs/api/data-permission.md`
  - `docs/api/audit.md`
  - `docs/api/config.md`
- 报告：
  - `docs/report/modules/platform-core.md`

### 核心业务

- 功能房预约：
  - `docs/requirements/facility-reservation.md`
  - `docs/api/facility-reservation.md`
  - `docs/report/modules/facility-reservation.md`
- 课程资源分享：
  - `docs/requirements/course-resources.md`
  - `docs/api/course-resources.md`
  - `docs/report/modules/course-resources.md`
- 数字图书馆（可选扩展）：
  - `docs/requirements/library.md`
  - `docs/api/library.md`
  - `docs/report/modules/library.md`

## 使用建议

- 如果要先进入正式报告写作，请优先阅读 `requirements-analysis/10-正式需求分析稿.md`
- 如果要继续数据库设计，请重点阅读：
  - `requirements-analysis/05-业务流程分析.md`
  - `requirements-analysis/06-功能需求规格.md`
  - `requirements-analysis/07-数据需求分析.md`
  - `requirements-analysis/11-需求到数据库设计跟踪矩阵.md`
  - `docs/course-design/db-delivery-checklist.md`
  - `docs/course-design/normalization-and-integrity.md`
- 如果要直接补课程设计正式报告，请按以下顺序阅读：
  - `docs/report/README.md`
  - `docs/report/manuscript/README.md`
  - `docs/report/overview/conceptual-structure-and-er.md`
  - `docs/report/overview/relation-schemas.md`
  - `docs/report/overview/data-dictionary.md`
  - `docs/report/database/physical-design.md`
  - `docs/report/database/typical-sql-and-transactions.md`
  - `docs/report/database/constraint-validation-and-tests.md`
- 报告撰写优先引用 `requirements-analysis/` 与 `docs/report/`，模块级需求和 API 文档作为支撑材料使用
