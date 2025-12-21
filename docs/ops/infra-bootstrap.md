# 运维｜基础设施初始化与验收清单（MVP）

**状态**：建议执行  
**版本**：v1.0  
**最近更新**：2025-12-20

> 目标：用最短路径把“用户/组织/权限/数据范围/审计/配置”跑通，并形成可复用的验收口径。  
> 原则：Supabase Auth 是账号生命周期唯一事实源；业务访问以 BFF（Next.js）为唯一入口；所有管理端写操作可审计。

## 0. 前置条件（一次性检查）

### 0.1 Supabase Auth 配置
- Email Provider 已开启，且 **需要邮箱验证**（Confirm email）。
- Site URL / Redirect URLs 已包含你的应用域名（本地开发：`http://localhost:3000`）。

### 0.2 环境变量
- 本地 `.env.local` 至少包含：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`（仅服务端使用）
  - `DATABASE_URL`

### 0.3 Supabase Storage 配置
- 创建 bucket：`avatars`，并设为 **public**（用于用户头像上传）。
- 创建 bucket：`course-resources`，并设为 **private**（用于课程资源分享模块文件直传与下载；由服务端生成 signed upload url/signed url，前端不需要持有 service_role 权限）。
- 创建 bucket：`library-books`，并设为 **private**（用于数字图书馆模块文件直传与下载；单文件上限 100MB；由服务端生成 signed upload url/signed url）。
- 创建 bucket：`material-templates`，并设为 **private**（材料收集：材料项模板文件）。
- 创建 bucket：`material-submissions`，并设为 **private**（材料收集：学生提交文件；默认敏感，下载走服务端签名 URL）。

## 1. 初始化步骤（按推荐顺序）

### 1.1 获取超级管理员权限（仅首次）
将你的账号绑定到 `roles.code=super_admin`（你已完成，可跳过）。

### 1.2 配置“注册审核开关”
入口：`/console/config`
- 默认建议：`requiresApproval=false`（常态自助注册）
- 需要人工审核时再开启：开启后用户邮箱验证通过会进入 `pending_approval`，需管理员通过。

### 1.3 建立部门树（组织）
入口：`/console/departments`
- 建议先建 **根节点**：学院线 / 学生组织线 / 党组织线（按你真实组织形态）。
- 再逐层补齐子部门（学院→专业→班级；学生会→部门→组；党支部→小组…）。
- 注意：
  - “部门及子部门”范围依赖闭包表维护（无需手动维护）。
  - 禁止删除：存在子部门 / 存在用户绑定 的部门。

### 1.4 建立岗位（Position）
入口：`/console/positions`
- 建议设置：
  - `name`：岗位名称（如 图书管理员）
  - `code`（可选）：稳定标识（如 librarian），便于跨系统/规则引用
  - `enabled`：可用于临时停用岗位（不建议用岗位做强鉴权）
- 删除岗位会自动解绑用户（不影响用户本身）。

### 1.5 建立角色（Role）与权限矩阵（RBAC）
入口：`/console/roles`
- 建议保留并使用内置角色：`user/staff/admin/super_admin`
- 按业务需要新增角色（示例）：`librarian/major_lead/...`
- 给角色分配权限码（支持 `*` 通配）：
  - 模块可见性（Console 导航）与 API 访问控制均依赖权限码
  - 建议权限码与模块命名保持一致：`campus:<module>:<op>`

### 1.6 配置数据范围（RoleDataScope）
入口：`/console/roles/:id` → 数据范围配置
- 已落地 `module=user`（用户管理）、`module=notice`（公告管理）、`module=material`（材料收集）、`module=survey`（问卷）的数据范围注入；其他模块按需逐步补齐。
- module 命名规则见：`docs/requirements/data-permission.md`

### 1.7 创建/邀请用户，并分配组织/角色/岗位
入口：`/console/users`
- 方式：
  - 手动创建（可选设置密码）
  - 邀请注册（邮件邀请）
  - 自助注册（用户自行注册+邮箱验证）
- 分配：
  - 角色：控制可见模块与 API 权限
  - 部门：支持多部门（例如 学院线 + 学生会线 + 党组织线）
  - 岗位：支持多岗位

## 2. 验收清单（按页面/用例）

### 2.1 登录与会话（Portal/Console）
- ✅ 使用邮箱/密码登录后可进入 `/notices`，并可点击“管理后台”进入 `/console`
- ✅ 若账号不可用（未验证/待审核/停用/封禁），登录页会给出明确提示并阻止进入
- ✅ 诊断接口：`GET /api/me` 返回 `allowed=true/false` 与 `blockCode`

### 2.2 部门管理
- ✅ 新增/编辑/移动部门：闭包表正常维护（父子移动不会形成环）
- ✅ 删除校验：
  - 有子部门：禁止删除
  - 有用户绑定：禁止删除
- ✅ 所有写操作在 `/console/audit` 可检索到记录

### 2.3 岗位管理
- ✅ 新增/编辑/启停/删除岗位正常
- ✅ 删除岗位后，原绑定用户的岗位关系被自动清理
- ✅ 所有写操作可审计

### 2.4 角色与权限
- ✅ 新增/编辑/删除角色正常（注意不要删除 `super_admin`）
- ✅ 角色权限支持 `*` 通配（示例：`campus:notice:*`）
- ✅ 不同角色登录后 Console 导航显隐符合预期（无权限不显示/不可访问）
- ✅ 所有写操作可审计

### 2.5 数据范围（验收 module=user / module=notice / module=material / module=survey）
- ✅ 为某角色配置 `module=user` 的数据范围（如 `CUSTOM` 选部门集合），`/console/users` 仅返回范围内用户（部门含子部门）
- ✅ 为某角色配置 `module=notice` 的数据范围，`/console/notices` 仅返回范围内公告（按公告 `created_by` 的部门归属判定）
- ✅ 为某角色配置 `module=material` 的数据范围，`/console/materials` 仅返回范围内材料任务（按任务 `created_by` 的部门归属判定）
- ✅ 为某角色配置 `module=survey` 的数据范围，`/console/surveys` 仅返回范围内问卷（按问卷 `created_by` 的部门归属判定）
- ✅ 多角色合并规则符合文档（最宽松优先）

### 2.6 用户生命周期（Supabase Auth + profile.status）
- ✅ 创建/邀请用户后，能在 Supabase Auth 与 Console 用户列表同时看到该用户
- ✅ 审核通过/驳回（若开启 requiresApproval）按状态机生效
- ✅ 停用/启用、封禁/解封、删除（soft）均生效，且访问被正确阻断
- ✅ 所有动作可审计

## 3. 常用排障 SQL（可选）
> 仅用于排查，避免在生产环境随意执行写操作。

### 3.1 查看某用户角色
```sql
select u.email, r.code
from auth.users u
join public.user_roles ur on ur.user_id = u.id
join public.roles r on r.id = ur.role_id
where u.email = 'xxx@example.com'
order by r.code;
```

### 3.2 查看某部门的子树（闭包表）
```sql
select d2.id, d2.name, dc.depth
from public.department_closure dc
join public.departments d1 on d1.id = dc.ancestor_id
join public.departments d2 on d2.id = dc.descendant_id
where d1.id = '部门ID'
order by dc.depth, d2.sort, d2.name;
```
