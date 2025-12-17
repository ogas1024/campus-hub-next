# 基础设施｜组织与岗位（Organization）需求说明

**状态**：✅ 已批准  
**版本**：v1.0（MVP 冻结版）  
**最近更新**：2025-12-17

> 本文定义平台组织架构（部门树）与岗位能力，并支撑“部门及子部门”的范围判断（公告可见范围、数据权限等）。

## 1. 范围（Scope）

### 1.1 MVP（必须实现）
- 部门管理（Console）
  - 树形展示、增删改（禁止删除存在子部门/存在用户绑定的部门）
  - 支持排序（`sort`）
  - 勾选交互参考 Ruoyi：父子联动（勾父默认全选子，可手动取消子）
- 岗位管理（Console）
  - 增删改
  - 启用/停用
  - 描述
  - 删除岗位：若存在用户绑定，自动解绑
- 用户组织归属（Console）
  - 用户可归属多个部门（可同时挂多条部门树路径）
  - 用户可拥有多个岗位

### 1.2 非目标（Out of Scope）
- 组织的“数据归属”自动推导（例如自动从班级推导到学院的持久化冗余）；本项目以闭包表实现范围判断，无需写入冗余 membership。

## 2. 领域模型（概览）

### 2.1 部门树（departments）
- 表：`public.departments`
- 字段（已存在）：`id, name, parent_id, sort, created_at, updated_at`
- 约束：
  - 允许多个根节点（`parent_id IS NULL`）
  - 禁止形成环（parent 不能是自身或其后代）

### 2.2 部门闭包表（department_closure）
> 目标：高性能实现“部门及子部门”判断，避免深层树频繁递归查询。

- 表：`public.department_closure`
- 字段：
  - `ancestor_id` uuid
  - `descendant_id` uuid
  - `depth` int（0 表示自身）
- 约束：
  - 主键：`(ancestor_id, descendant_id)`
  - 必须包含 `(d, d, 0)` 的自反记录
- 维护规则：
  - 新增部门：为新节点写入自身闭包，并继承其祖先链
  - 移动部门（变更 parent）：需要更新该节点及其子树的闭包关系
  - 删除部门：MVP 禁止删除存在子部门/用户绑定的部门（因此不需要子树级联删除逻辑）

### 2.3 用户-部门（user_departments）
> 支持用户多部门归属（多条路径）。

- 表：`public.user_departments`
- 字段（建议）：
  - `user_id` uuid（= `auth.users.id`）
  - `department_id` uuid
  - `created_at` timestamptz
- 约束：
  - 主键：`(user_id, department_id)`
  - 外键：`user_id -> auth.users(id)`（cascade）
  - 外键：`department_id -> departments(id)`（restrict 或 cascade 由实现阶段确定；MVP 删除部门禁止有绑定）

### 2.4 岗位（positions）
- 表：`public.positions`
- 当前字段（已存在）：`id, name, sort, created_at, updated_at`
- MVP 增强字段（需求）：
  - `code`（可选）：稳定标识，便于跨系统引用/对接；若引入需唯一
  - `description`（可选）
  - `enabled` boolean（默认 true）

> 取舍说明：若岗位仅用于展示与简单范围筛选，可不引入 `code`；若未来多个系统共享岗位字典或需要稳定引用，建议引入 `code`。

### 2.5 用户-岗位（user_positions）
- 表：`public.user_positions`（已存在，多对多）
- 删除岗位：先解绑 `user_positions`（自动），再删除岗位记录。

## 3. 关键业务规则与约束

### 3.1 “部门及子部门”范围判定（统一口径）
当系统以部门作为“范围/可见性/数据权限”的维度时，默认规则为：
- 若某范围配置为部门 `D`，则命中集合为 `D` 及其所有子孙部门。
- 若用户归属部门为 `U`（可能多条），则用户对部门范围的命中判断为：
  - 存在某个 `U` 满足：`U` 是 `D` 的后代或自身（通过 `department_closure` 判断）

该规则将应用于：
- 通知公告按部门可见范围（见 `docs/requirements/notices.md`）
- 数据范围/数据权限（见 `data-permission.md`）

### 3.2 部门删除
- 禁止删除存在子部门的部门。
- 禁止删除存在用户绑定（`user_departments`）的部门。
- 后续 Phase 2 可考虑“级联迁移/批量转移”。

### 3.3 岗位删除
- 若岗位存在用户绑定：删除时必须先自动解绑（删除 `user_positions` 关联），再删除岗位。

### 3.4 Console 勾选交互（参考 Ruoyi）
部门选择（用于用户归属、公告范围、数据权限等）：
- 勾选父部门：默认选中全部子部门（可手动取消子部门）
- 取消父部门：默认取消全部子部门（可手动再选子部门）
- UI 必须可见地表达“部分选中（半选）”状态

## 4. 用例列表（MVP）
- UC-O1：部门树管理（新增子部门、改名、排序、移动节点）
- UC-O2：岗位管理（新增、编辑、启停、删除自动解绑）
- UC-O3：给用户分配/移除部门（多选）
- UC-O4：给用户分配/移除岗位（多选）

## 5. 验收标准（MVP）
- 部门树可正确维护父子关系与排序；禁止形成环。
- 部门范围判断支持“部门及子部门”，且与闭包表一致。
- 删除部门在“存在子部门/存在用户绑定”时被正确阻止并给出明确错误。
- 删除岗位会自动解绑用户，不留脏关联。
- 部门选择交互满足“父子联动 + 半选”体验。
