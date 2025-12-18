# 鉴权与用户（入口说明）

**状态**：✅ 已批准  
**版本**：v1.0  
**最近更新**：2025-12-17

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
