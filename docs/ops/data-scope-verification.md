# 运维｜数据范围（DataScope）验收用例（MVP）

**状态**：建议执行  
**版本**：v1.0  
**最近更新**：2025-12-18

> 目标：用可重复的步骤验收“数据范围”能力是否按预期生效，尤其是**部门及子部门**、**多角色合并**。  
> 当前落地范围：仅要求在 `module=user`（用户列表）完成注入验收；其他模块按需接入（属于后续迭代）。

## 0. 前置条件

- 你已拥有 `admin` 或 `super_admin` 权限，可访问：
  - `/console/departments`
  - `/console/roles`
  - `/console/users`
- 已阅读/接受多角色合并规则：`docs/requirements/data-permission.md` → 4.2

## 1. 关键口径（验收时以此为准）

### 1.1 module 命名（冻结）
- `module` 来自权限码 `campus:<module>:<op>` 的 `module` 段
- `module=user` ↔ `/console/users` ↔ `/api/console/users`

### 1.2 默认兜底规则（无显式配置时）
若用户在 `module=user` 下没有任何 RoleDataScope 配置：
- 角色含 `admin/super_admin` → 视为 `ALL`
- 否则 → 视为 `SELF`

## 2. 准备数据（推荐一次性创建）

### 2.1 部门树（用于“部门及子部门”测试）
在 `/console/departments` 创建如下结构（名称可自定义）：
- 信息学院（A）
  - 计算机科学与技术（A1）
    - 计科 2023-1 班（A11）
- 学生会（B）
  - 文工团（B1）
    - 美工组（B11）

### 2.2 测试角色（用于不同 scopeType）
在 `/console/roles` 创建以下角色（示例 code）：
- `user_view_all`：拥有 `campus:user:list`，数据范围配置为 `ALL`
- `user_view_dept`：拥有 `campus:user:list`，数据范围配置为 `DEPT`
- `user_view_dept_child`：拥有 `campus:user:list`，数据范围配置为 `DEPT_AND_CHILD`
- `user_view_custom`：拥有 `campus:user:list`，数据范围配置为 `CUSTOM`
- `user_view_self`：拥有 `campus:user:list`，数据范围配置为 `SELF`
- `user_view_none`：拥有 `campus:user:list`，数据范围配置为 `NONE`

> 注意：为了能进入 `/console/users`，这些测试角色必须具备 `campus:user:list`，否则会直接被 RBAC 拦截，无法验收 DataScope。

### 2.3 测试用户（覆盖不同部门归属）
在 `/console/users` 创建（或邀请/自助注册后由管理员补齐组织与角色）：
- U-A（只属于 A：信息学院）
- U-A11（只属于 A11：计科 2023-1 班）
- U-B11（只属于 B11：美工组）
- U-MIX（同时属于 A11 + B11，多部门）

> 建议每个用户只分配一个“测试角色”，便于对照；多角色合并在 4 里单独验收。

## 3. 单角色验收（scopeType 行为）

下面每条都按同一模式执行：
1) 用管理员在 `/console/users` 给测试账号绑定角色与部门  
2) 退出管理员登录  
3) 用测试账号登录进入 `/console/users`  
4) 观察列表结果与筛选行为

### 3.1 `ALL`
角色：`user_view_all`  
期望：
- 能看到所有用户（U-A/U-A11/U-B11/U-MIX…）

### 3.2 `NONE`
角色：`user_view_none`  
期望：
- 用户列表为空（总数为 0）

### 3.3 `SELF`
角色：`user_view_self`  
期望：
- 只能看到自己

### 3.4 `DEPT`
角色：`user_view_dept`  
准备：将该账号绑定部门为 A（信息学院）  
期望：
- 能看到属于 A 的用户（U-A）
- **不能**看到仅属于 A 的子部门的用户（U-A11）

### 3.5 `DEPT_AND_CHILD`
角色：`user_view_dept_child`  
准备：将该账号绑定部门为 A（信息学院）  
期望：
- 能看到属于 A 的用户（U-A）
- 能看到属于 A 的任意子部门的用户（U-A11）
- 不能看到 B 分支用户（U-B11）

### 3.6 `CUSTOM`
角色：`user_view_custom`  
准备：在角色详情页 `/console/roles/:id` → “数据范围”中，设置：
- `module=user`
- `scopeType=CUSTOM`
- 选中部门集合：只选 B（学生会）或只选 B11（美工组）均可
期望（以只选 B 为例）：
- 能看到 B 及其子部门的用户（U-B11）
- 不能看到 A 分支用户（U-A/U-A11）

## 4. 多角色合并验收（最宽松优先）

### 4.1 合并规则回顾（MVP）
优先级：`ALL` > `CUSTOM` > `DEPT_AND_CHILD` > `DEPT` > `SELF` > `NONE`

### 4.2 用例：`DEPT` + `DEPT_AND_CHILD` → `DEPT_AND_CHILD`
给同一账号同时绑定两个角色：
- `user_view_dept`
- `user_view_dept_child`
并把该账号绑定部门为 A（信息学院）  
期望：
- 结果等价于 `DEPT_AND_CHILD`（能看到 U-A 与 U-A11）

### 4.3 用例：`CUSTOM` + `DEPT_AND_CHILD` → `CUSTOM（并集）`
给同一账号同时绑定：
- 一个 `CUSTOM`（只选 B）
- 一个 `DEPT_AND_CHILD`（账号部门为 A）
期望：
- 能同时看到 A（含子）与 B（含子）的用户（U-A/U-A11/U-B11）

### 4.4 用例：`NONE` + `SELF` → `SELF`
给同一账号同时绑定：
- `user_view_none`
- `user_view_self`
期望：
- 只能看到自己

## 5. 已知限制（MVP）

- 当前仅在用户列表（`/console/users`）完成 DataScope 注入验收；其他模块（公告/课程资源/预约/图书等）后续逐模块接入。
- DataScope 只负责“可见数据过滤”，不替代 RBAC：无 `campus:user:list` 时仍无法进入用户管理。

