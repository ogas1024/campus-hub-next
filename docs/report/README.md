# 课程设计报告材料总入口

## 1. 目录定位

本目录用于沉淀《数据库原理及应用》课程设计正式报告和答辩所需的数据库设计材料。为了避免“文件越写越多、越写越散”，当前将本目录明确拆成两层：

- 支撑材料
  - 用于沉淀关系模式、模块设计、物理设计、事务设计、测试分析等专题材料
- 正式报告正文
  - 用于最终组装成可提交的课程设计报告章节

写作重点不是页面效果，而是：

- 概念结构与关系模式
- 主键、候选键、外键
- 完整性约束
- 规范化与必要冗余
- 索引、触发器、物理设计
- 典型 SQL、事务与并发控制
- 约束验证与测试结果

所有结论均以当前仓库中的迁移脚本和服务实现为准。

## 2. 什么是“正式报告正文”

这里所说的“正式报告正文”，不是某一篇单独的分析文档，而是最后真正要交的那份章节化报告。它通常具备以下特征：

- 按课程设计报告章节顺序连续成文
- 同一概念只在最合适的位置讲一次，不再分散重复
- 能直接导出或打印提交
- 会引用本目录下的支撑材料，但本身不是“资料堆”

当前已为这部分预留独立位置：

- `manuscript/`
  - 用于后续组装正式报告正文

## 3. 当前目录结构

- `overview/`
  - 总体关系模式、数据字典、概念结构设计与 ER 图等“全局基础材料”
- `modules/`
  - 各主线模块的数据库设计报告
- `database/`
  - 物理设计、典型 SQL/事务、约束验证与测试
- `manuscript/`
  - 最终提交版课程设计报告正文

## 4. 推荐阅读顺序

1. `overview/conceptual-structure-and-er.md`
2. `overview/relation-schemas.md`
3. `overview/data-dictionary.md`
4. `modules/platform-core.md`
5. `modules/facility-reservation.md`
6. `modules/course-resources.md`
7. `database/physical-design.md`
8. `database/typical-sql-and-transactions.md`
9. `database/constraint-validation-and-tests.md`
10. `modules/library.md`

## 5. 文档说明

### 总体设计

- `overview/conceptual-structure-and-er.md`
  - 以分层、分模块的方式集中展示概念结构设计与 E-R 图
- `overview/relation-schemas.md`
  - 从全局汇总主线模块的关系模式、主键、外键、完整性和范式判断
- `overview/data-dictionary.md`
  - 以数据字典形式列出核心表字段、类型、可空性和约束

### 模块报告

- `modules/platform-core.md`
  - 身份与资料、组织结构、RBAC、数据范围、审计日志
- `modules/facility-reservation.md`
  - 楼房、房间、预约、参与人、封禁、冲突控制
- `modules/course-resources.md`
  - 专业、课程、资源、审核流、去重、下载事件、积分事件
- `modules/library.md`
  - 可选扩展，作为与课程资源相近的同构业务补充

### 报告增强材料

- `database/physical-design.md`
  - 索引、触发器、删除策略、部分唯一索引、物理外键等实现说明
- `database/typical-sql-and-transactions.md`
  - 可直接写入报告的典型 SQL、事务流程和并发控制分析
- `database/constraint-validation-and-tests.md`
  - 结构约束测试、失败场景、数据库保证与服务层保证的边界

### 正式报告正文

- `manuscript/README.md`
  - 说明正式报告正文的写法、结构和后续组装方式

## 6. 使用建议

- 若正在撰写“概念结构设计”章节，优先引用 `overview/conceptual-structure-and-er.md`
- 若正在撰写“逻辑结构设计”章节，优先引用 `overview/relation-schemas.md` 与 `overview/data-dictionary.md`
- 若正在撰写“物理设计与实现”章节，优先引用 `database/physical-design.md`
- 若正在撰写“典型 SQL 与事务设计”章节，优先引用 `database/typical-sql-and-transactions.md`
- 若正在撰写“系统测试与结果分析”章节，优先引用 `database/constraint-validation-and-tests.md`
- 若需要回答“老师为什么会觉得这套数据库设计较完整”，应把模块报告与后三份增强材料结合使用
