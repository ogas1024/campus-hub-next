# 鉴权与用户（入口说明）

**状态**：✅ 已批准  
**版本**：v1.0  
**最近更新**：2025-12-22

> 说明：本项目鉴权相关需求已按“基础设施域”拆分为多份文档，以减少耦合、提升可维护性与可扩展性。

## 文档入口
- 身份与访问控制（IAM）：`docs/requirements/iam.md`
- 组织与岗位（部门树/岗位/用户多部门）：`docs/requirements/organization.md`
- 数据范围与数据权限（类似 Ruoyi）：`docs/requirements/data-permission.md`
- 审计日志（管理端全量审计）：`docs/requirements/audit.md`

## 总原则（冻结）
- Supabase Auth（`auth.users`）为身份与生命周期唯一事实来源（Create/Invite/Ban/Delete 必须走 Admin API）。
- `public.profiles(id=auth.users.id)` 为业务扩展信息；`profiles` 保持极简，业务域通过独立扩展表扩展用户属性。
- RBAC（权限码）控制模块可见性与接口访问；数据权限控制“可见数据范围”，两者分层。

## 会话刷新与 Cookie 写入（App Router 约束）

- Next.js App Router 限制：Server Component 渲染阶段不能写 Cookie（只能在 Server Action / Route Handler / Middleware 中写）。
- 本项目采用 Proxy（Next.js 16 的中间件替代约定）统一刷新 Supabase 会话并写回 Cookie：
  - 入口：`campus-hub-next/proxy.ts`
  - 性能策略：当请求不包含任何 `sb-*` 会话 Cookie 时，Proxy 跳过 Supabase 请求（减少匿名访问开销）。
- Server Component 侧（例如 `getCurrentUser()`）只负责读取 Cookie 并调用 Supabase；若触发 token 轮换写 Cookie，写入由 Proxy 处理，服务端仅做“禁止写 Cookie”错误的兜底忽略。
