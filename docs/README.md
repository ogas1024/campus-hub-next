# Campus Hub 文档中心

欢迎来到 Campus Hub 项目文档中心。本文档用于约束“文档驱动开发”的单一事实来源，避免历史探索内容误导实现。

---

## ✅ 当前实施基线（请以此为准）

当前阶段的“单一事实来源（Single Source of Truth）”：
- 需求：`docs/requirements/README.md`（模块需求索引；已冻结模块会标记 ✅）
- 模块 API：在每个模块进入实现前新增 `docs/api/<module>.md`（本仓库会按模块逐步补齐）
- 环境变量：`campus-hub-next/.env.example`（模板），以及你本地的 `campus-hub-next/.env.local`（真实值）

说明：若未来新增 `docs/_legacy/`，其中内容仅作历史参考，不作为实现依据。

## 📁 文档结构

### [Requirements (需求)](./requirements/)
模块需求与用例 - 范围、角色、业务规则，是设计/开发的前置契约。

---
## 🔄 维护原则（精简）
- 需求优先：先更新 `docs/requirements`，再写实现。
- 契约先行：每个进入实现的模块补一份 `docs/api/<module>.md`，作为前后端协作契约。
- 避免误导：任何过期内容必须显式标注“归档/过期”，或迁入 `docs/_legacy/`。
