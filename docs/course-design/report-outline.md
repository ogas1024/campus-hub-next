# 课程设计报告组织建议

## 章节结构

1. 课题概述与需求分析
   - 题目：校园生活平台
   - 本轮聚焦范围：平台基础、功能房预约、课程资源分享
   - 说明为什么不以“全平台所有模块”作为本次数据库设计范围

2. 总体技术路线
   - 以 PostgreSQL 为核心数据库
   - Supabase 仅作为 Postgres/Auth/Storage 运行环境
   - 应用架构只做简述，不作为报告主体

3. 概念结构设计
   - 平台基础子系统 ER 图
   - 功能房预约 ER 图
   - 课程资源分享 ER 图
   - 数字图书馆可作为扩展 ER 图
   - 可直接引用：`docs/report/overview/conceptual-structure-and-er.md`

4. 逻辑结构设计
   - 关系模式
   - 主键、外键、候选键
   - 主属性、非主属性
   - 多对多关系拆分
   - 关键函数依赖与规范化说明

5. 物理设计与实现
   - 表结构
   - 索引设计依据
   - 删除策略
   - 检查约束
   - 触发器 / 数据库函数
   - 审计与安全策略
   - 可直接引用：`docs/report/database/physical-design.md`

6. 核心业务数据库实现
   - 平台基础：组织树、RBAC、数据范围、审计日志
   - 功能房预约：时间冲突、状态流转、参与人建模
   - 课程资源分享：审核流、去重、下载与积分事件

7. 典型 SQL 与事务设计
   - 树结构查询
   - 数据范围过滤
   - 排行榜统计
   - 审计记录写入
   - 并发控制与事务一致性
   - 可直接引用：`docs/report/database/typical-sql-and-transactions.md`

8. 系统测试与结果分析
   - 结构约束测试
   - 典型业务流程测试
   - 异常场景测试
   - 已落库规则与未完全落库规则边界
   - 可直接引用：`docs/report/database/constraint-validation-and-tests.md`

9. 总结与后续优化
   - 本轮数据库设计收获
   - 仍可继续优化的地方

## 文档映射

- 总入口：`docs/course-design/README.md`
- 报告材料入口：`docs/report/README.md`
- 正式报告正文说明：`docs/report/manuscript/README.md`
- 概念结构设计与 ER 图：`docs/report/overview/conceptual-structure-and-er.md`
- 平台基础报告：`docs/report/modules/platform-core.md`
- 功能房预约报告：`docs/report/modules/facility-reservation.md`
- 课程资源报告：`docs/report/modules/course-resources.md`
- 数字图书馆报告：`docs/report/modules/library.md`
- 物理设计说明：`docs/report/database/physical-design.md`
- 典型 SQL 与事务：`docs/report/database/typical-sql-and-transactions.md`
- 约束验证与测试：`docs/report/database/constraint-validation-and-tests.md`

## 数据库设计主线

正式报告最好显式体现下面这条主线，而不是把材料写散：

1. 需求分析
   - 业务对象、联系、约束来源
2. 概念结构设计
   - E-R 图、实体与联系抽取
3. 逻辑结构设计
   - 关系模式、主键/候选键、函数依赖、范式判断
4. 物理设计
   - 索引、删除策略、`CHECK`、`UNIQUE`、触发器、审计与安全
5. 测试与验证
   - 约束失败样例、事务一致性、并发场景

建议在正文中把“概念结构设计 -> 逻辑结构设计 -> 物理设计 -> 测试”的因果链写出来：

- 哪个业务规则来自需求分析
- 它在 E-R 图里对应哪个联系
- 它在关系模式里对应哪个主键/外键/候选键/函数依赖
- 它最后在数据库里由哪个约束、索引、触发器或事务保证

## 撰写建议

- 把界面截图压缩到最低必要程度。
- 每一章尽量落到具体表、约束、SQL 和业务规则上。
- 答辩时优先讲数据库为什么这样设计，而不是页面怎么做出来。
