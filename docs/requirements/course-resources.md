# 课程资源分享 需求说明
**状态**：🟠 待完善  
**版本**：v0.1  
**最近更新**：2025-12-11

## 范围（Scope）
- 目标：学生上传/浏览课程资料，管理员审核与发布。
- MVP：上传文件/链接、标签分类、审核发布、搜索与分页、我上传的资源列表。
- 非目标：付费下载、积分体系、P2P 传输。

## 角色与权限
- user：上传、编辑/删除自己资源（草稿/驳回状态）。
- staff/admin：审核、发布/下架（campus:resource:publish）。

## 关键用例
- 作为 user，我要上传课程资料并等待审核。
- 作为 staff，我要审核资源并发布到前台列表。

## 领域模型
- Resource：id、title、description、tags、fileKey/url、status、ownerId、departmentId。
- Review：id、resourceId、reviewerId、decision、comment。

## 业务规则与约束
- 状态：draft → pending → published/unpublished/rejected。
- 文件存储走 StorageAdapter，支持预签名上传。

## 开放问题
- 是否需要防重复（文件 hash）？
- 是否需要访问范围控制（按院系/角色）？
