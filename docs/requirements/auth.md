# 鉴权与用户 需求说明
**状态**：🟠 待完善  
**版本**：v0.1  
**最近更新**：2025-12-11

## 范围（Scope）
- 目标：统一登录/注册、角色/权限管理、当前用户信息。
- MVP：邮箱/密码 + Magic Link 登录，当前用户查询，角色分配，权限检查接口。
- 非目标：社交登录、MFA、SSO。

## 角色与权限
- user：基础访问。
- admin/super_admin：管理用户、角色、权限（campus:rbac:*）。

## 关键用例
- 作为 user，我要登录并查看个人信息。
- 作为 admin，我要为用户分配角色与权限。

## 领域模型
- UserProfile：authId、email、displayName、roles、permissions。
- Role：code、name、scope。
- Permission：code、module、action。

## 业务规则与约束
- 权限码格式：campus:<module>:<op>。
- Supabase Auth 为身份源，业务表扩展属性。

## 开放问题
- 是否需要临时访问令牌？
- 是否需要审批流变更角色？
