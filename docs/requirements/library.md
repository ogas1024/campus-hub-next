# 数字图书馆 需求说明
**状态**：🟠 待完善  
**版本**：v0.1  
**最近更新**：2025-12-11

## 范围（Scope）
- 目标：在线浏览/借阅电子书或条目，管理员维护目录。
- MVP：图书录入、分类/标签、搜索、借阅记录（逻辑借阅），前后台列表。
- 非目标：与实体馆藏同步、DRM、计费。

## 角色与权限
- user：浏览、借阅。
- librarian/admin：新增/编辑、下架、审核借阅（campus:library:manage）。

## 关键用例
- 作为 user，我要搜索并借阅电子书。
- 作为 librarian，我要维护图书信息与借阅状态。

## 领域模型
- Book：id、title、author、isbn、category、tags、fileKey/url、status。
- BorrowRecord：id、bookId、userId、borrowedAt、dueAt、returnedAt、status。

## 业务规则与约束
- 借阅状态机：available → borrowed → returned/overdue。
- 文件访问需签名 URL。

## 开放问题
- 是否需要库存/并发借阅限制？
- 是否需要收藏/评分？
