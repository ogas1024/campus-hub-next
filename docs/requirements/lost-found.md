# 失物招领 需求说明
**状态**：🟠 待完善  
**版本**：v0.1  
**最近更新**：2025-12-11

## 范围（Scope）
- 目标：发布失物/招领信息，支持认领与状态变更。
- MVP：发布/列表/详情、图片上传、认领申请与审核、状态流转（发布→认领中→已认领）。
- 非目标：自动图像识别匹配、线下交接追踪。

## 角色与权限
- user：发布、编辑自己信息、发起认领。
- staff/admin：审核认领、关闭信息。

## 关键用例
- 作为 user，我要发布丢失物品并上传图片。
- 作为 staff，我要审核认领申请并标记完成。

## 领域模型
- LostItem：id、title、description、images、lostAt/location、status、ownerId。
- Claim：id、lostItemId、claimerId、evidence、status、reviewerId。

## 业务规则与约束
- 图片存储经 StorageAdapter。
- 状态：open → in_review → resolved/rejected.

## 开放问题
- 是否需要匿名发布？
- 是否需要消息通知？
