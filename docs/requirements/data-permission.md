# 基础设施｜数据范围与数据权限（Data Permission）需求说明

**状态**：✅ 已批准  
**版本**：v1.0（MVP 冻结版）  
**最近更新**：2025-12-17

> 说明：RBAC 解决“能不能访问某功能/接口”，数据权限解决“能访问的数据范围是多少”。  
> 本项目采用 BFF 强约束：数据权限在 Service/Repository 层统一计算与注入，避免散落在 Route Handler/前端。

## 1. 范围（Scope）

### 1.1 MVP（必须实现）
- 为 Console 管理端提供“数据范围”能力（类似 Ruoyi），至少覆盖：
  - 用户管理（查看用户/组织/岗位等）
  - 通知公告管理、课程资源、预约、图书等未来模块（可逐步接入）
- 数据范围按“角色”配置（RoleDataScope），并支持多角色合并。
- 支持组织维度的范围（部门及子部门），与 `organization.md` 的口径一致。

### 1.2 非目标（Out of Scope）
- 依赖复杂 DB RLS 策略实现数据权限（可作为 Phase 2 研究）。
- 为每个业务模块一次性实现完整数据权限（MVP 提供框架与最小落地，逐模块接入）。

## 2. 设计原则（业内最佳实践取向）
- **职责分离**：权限码（RBAC）与数据范围（DataScope）分离配置与计算。
- **可组合**：同一用户多角色时，数据范围按“最宽松优先”合并（详见 4.2）。
- **可审计**：任何角色数据范围变更必须写审计日志（见 `audit.md`）。
- **可扩展**：新增模块只需声明其“数据归属字段”（如 `created_by`、`department_id`），无需复制粘贴权限逻辑。

### 2.1 module 命名规范（冻结）
- `module` 来自权限码 `campus:<module>:<op>` 的 `module` 段，必须**全局唯一、稳定**。
- `module` 与 Console 资源命名必须一一对应：建议 `/api/console/<resource>` 与 `/console/<resource>` 采用 `module` 的**复数**形式（例如 `module=user` ↔ `resource=users`），避免出现同一业务域多套命名造成长期维护成本。
- 允许字符建议：`^[a-z][a-z0-9_]*$`（小写字母/数字/下划线），避免 `-`，以降低跨系统对接成本。
- `module` 既用于 RBAC 权限码，也用于 RoleDataScope 的配置键；禁止同一业务域出现多种 `module` 命名。

### 2.2 module 建议清单（MVP/近中期）
| module | 领域/模块 | 典型权限码示例 | Console 路由建议 |
| --- | --- | --- | --- |
| `user` | 用户管理 | `campus:user:list` | `/console/users` |
| `role` | 角色管理 | `campus:role:*` | `/console/roles` |
| `permission` | 权限字典/分配 | `campus:permission:*` | `/console/permissions` |
| `department` | 部门管理（树） | `campus:department:*` | `/console/departments` |
| `position` | 岗位管理 | `campus:position:*` | `/console/positions` |
| `audit` | 审计日志 | `campus:audit:list` | `/console/audit` |
| `config` | 平台配置 | `campus:config:update` | `/console/config` |
| `notice` | 通知公告 | `campus:notice:*` | `/console/notices` |
| `resource` | 课程资源分享 | `campus:resource:*` | `/console/resources` |
| `facility` | 功能房预约 | `campus:facility:*` | `/console/facilities` |
| `library` | 数字图书馆 | `campus:library:*` | `/console/library` |
| `lostfound` | 失物招领 | `campus:lostfound:*` | `/console/lostfound` |

## 3. 领域模型（概览）

### 3.1 RoleDataScope（按模块配置）
建议将数据范围配置为表结构（实现阶段落表）：
- `role_data_scopes`
  - `role_id`
  - `module`（必须与权限码 `campus:<module>:<op>` 的 `module` 段一致，例如 `notice` ↔ `campus:notice:*`）
  - `scope_type`
  - `created_at/updated_at`
- `role_data_scope_departments`（当 `scope_type=CUSTOM` 时）
  - `role_id`
  - `module`
  - `department_id`

### 3.2 ScopeType（范围类型）
MVP 支持的范围类型（可扩展）：
- `ALL`：全量
- `CUSTOM`：自定义部门集合（部门及子部门）
- `DEPT`：用户所属部门（精确部门集合）
- `DEPT_AND_CHILD`：用户所属部门及子部门
- `SELF`：仅本人数据（如 `created_by = userId`）
- `NONE`：不可见

> 注意：范围类型是否对某资源有效，取决于该资源是否具备相应“归属字段”。无归属字段的资源默认只支持 `ALL/SELF/NONE`。

## 4. 关键业务规则与约束

### 4.1 部门范围口径
部门范围判定统一为“部门及子部门”，并依赖部门闭包表（见 `organization.md`）。

### 4.2 多角色合并规则（MVP）
同一用户在同一 `module` 下拥有多个角色的数据范围时，采用“最宽松优先”的合并策略：
- 若任一角色为 `ALL` → 结果为 `ALL`
- 否则若存在 `CUSTOM` → 结果为 `CUSTOM`，部门集合为所有 `CUSTOM` 部门的并集（再扩展到子部门）
- 否则若存在 `DEPT_AND_CHILD` → 结果为 `DEPT_AND_CHILD`，以用户所属部门集合为基础扩展到子部门
- 否则若存在 `DEPT` → 结果为 `DEPT`，仅用户所属部门集合
- 否则若存在 `SELF` → 结果为 `SELF`
- 否则 `NONE`

> 说明：该策略符合多数后台管理场景（角色越多权限越大），也更可维护；如未来需要“最严格优先（交集）”，应作为显式的系统策略开关引入。

### 4.3 查询注入约束（强约束）
- Route Handler 只做：参数解析、调用 Service、返回错误/响应；不得拼接数据权限 where 条件。
- Repository 层不得自行决定“谁能看什么”，必须接收 Service 计算出的 DataScope，并以统一 helper 注入过滤条件。

### 4.4 模块可见性 vs 数据范围
用户“看不到某模块”应由 RBAC（权限码）控制：
- UI 菜单：按权限码渲染
- API：按权限码拦截
数据范围仅用于“已获得访问权限后，对列表/查询的数据进行过滤”。

## 5. 用例列表（MVP）
- UC-D1：管理员在角色管理中配置某角色对某模块的数据范围
- UC-D2：用户拥有多个角色时，系统计算合并后的有效范围
- UC-D3：管理端列表查询自动按有效范围过滤

## 6. 验收标准（MVP）
- 至少在 1 个管理端列表接口中完成数据范围注入验证（推荐优先：用户列表或公告列表）。
- 多角色合并规则可被用例覆盖，并在文档中无歧义。
- 部门范围过滤可正确命中“部门及子部门”。
- 角色数据范围变更可被审计追踪（见 `audit.md`）。
