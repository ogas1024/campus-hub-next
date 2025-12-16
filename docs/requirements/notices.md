# 通知公告模块需求说明（MVP 冻结版）
**状态**：✅ 已批准  
**版本**：v1.0（MVP）  
**最近更新**：2025-12-12

## 1. 目标与定位
- 面向校内用户的通知/公告发布与阅读，支持 Markdown 内容、附件、置顶、有效期与阅读回执。
- 可见范围支持：全员、按角色、按部门、按岗位。
- 本模块不引入审批流/定时发布等“需要调度系统”的能力，避免为了 MVP 引入额外基础设施。

## 2. 角色与权限（纯 RBAC）
说明：
- **阅读端**仅要求登录（`requireUser`），不强制权限码；发布端/管理端需要权限码。
- “是否能操作他人公告”属于资源级授权规则：默认仅能操作自己创建的公告；管理员可操作所有公告。

### 2.1 角色
- user：阅读公告、下载附件、查看已读/未读。
- staff：创建/编辑/删除自己的公告；发布/撤回/置顶自己的公告。
- admin/super_admin：公告全量增删改查与发布、置顶、撤回。

### 2.2 权限码（建议）
- `campus:notice:list`：管理端列表/查询（可查看本人与全量，取决于角色）
- `campus:notice:create`：创建公告
- `campus:notice:update`：编辑公告
- `campus:notice:delete`：删除公告（软删）
- `campus:notice:publish`：发布/撤回
- `campus:notice:pin`：置顶/取消置顶
- `campus:notice:manage`：全量管理（可选；用于放开“操作他人公告”的限制）

## 3. 功能范围（MVP）

### 3.1 发布端（Console）
- 新增/编辑/删除：
  - 编辑体验为富文本“所见即所得”（WYSIWYG），落库存储为 Markdown（不允许内联 HTML）；展示端统一做 Markdown 渲染与安全过滤。
  - 字段：标题、正文、附件、有效期、可见范围（全员/自定义）。
- 发布/撤回：
  - 发布后出现在阅读端列表；撤回后仅创建者与管理员可见（用于编辑/复用）。
  - 发布与撤回必须幂等。
- 置顶/取消置顶：
  - 置顶仅对“已发布且未过期”的公告生效；撤回会自动取消置顶。
  - 置顶按 `pinnedAt` 倒序排序，最新置顶排最前；不设置数量上限。
- 可见范围：
  - `visibleAll=true`：全员可见。
  - `visibleAll=false`：至少配置 1 条 scope；role/dept/position 任意匹配即可见（OR 逻辑）。
- 编辑计数：
  - 每次编辑成功：`editCount + 1`，更新 `updatedAt`。

### 3.2 阅读端（Portal）
- 列表分页（置顶优先），支持标题关键词搜索。
- 已读/未读：
  - 进入详情自动记录阅读回执（幂等：同一用户对同一公告仅首次写入）。
  - 列表返回 `read` 状态。
- 筛选：
  - `includeExpired`：是否包含已过期（默认不包含）。
  - `read`：已读/未读过滤（可选）。
- 排序：
  - 支持按 `publishAt/updatedAt/expireAt` 选择排序字段；置顶永远优先。
- 过期展示：
  - 过期公告的详情可访问，但明显标注“已过期”；列表默认不展示（除非 `includeExpired=true`）。
- 附件下载：
  - 详情展示附件列表并可下载；下载链接为短期签名 URL（避免公开桶与越权访问）。

### 3.3 统计（MVP）
- 阅读计数：
  - “打开详情即计数”，基于阅读回执表去重计数。

## 4. 数据模型（概览）
命名说明：以下为建议表名（snake_case），字段以 `timestamptz` 存储（带时区）。

### 4.1 notices（公告主体）
- `id` uuid PK
- `title` text（必填，<=200）
- `content_md` text（必填，Markdown）
- `status` text（draft|published|retracted）
- `visible_all` boolean
- `pinned` boolean
- `pinned_at` timestamptz（nullable）
- `publish_at` timestamptz（nullable）
- `expire_at` timestamptz（nullable）
- `created_by` uuid（Supabase Auth 用户 ID，即 `auth.users.id`）
- `updated_by` uuid（Supabase Auth 用户 ID，nullable）
- `edit_count` int（默认 0）
- `read_count` int（默认 0，可选冗余）
- `created_at/updated_at/deleted_at` timestamptz

### 4.2 notice_scopes（可见范围条目）
- `id` uuid PK
- `notice_id` uuid
- `scope_type` text（role|department|position）
- `ref_id` uuid（对应 roles/departments/positions 的 id）
- 唯一约束：`(notice_id, scope_type, ref_id)`

### 4.3 notice_attachments（附件）
- `id` uuid PK
- `notice_id` uuid
- `file_key` text（Storage object key）
- `file_name` text（原始文件名）
- `content_type` text
- `size` int
- `sort` int（默认 0）

### 4.4 notice_reads（阅读回执）
- `id` uuid PK
- `notice_id` uuid
- `user_id` uuid（Supabase Auth 用户 ID，即 `auth.users.id`）
- `read_at` timestamptz
- 唯一约束：`(notice_id, user_id)`

## 5. 可见性判定规则（访问控制）
- 若 `visible_all=true`：对所有已登录用户可见（前提：公告已发布，或用户有管理权限/为创建者）。
- 若 `visible_all=false`：用户满足以下任一条件即可见：
  - 用户任一角色命中 `notice_scopes(scope_type=role)`
  - 用户任一部门命中 `notice_scopes(scope_type=department)`
  - 用户任一岗位命中 `notice_scopes(scope_type=position)`

## 6. 状态与流转
- `draft` → `published` → `retracted`
- 过期为“派生状态”（不落库）：当 `status=published` 且 `expire_at IS NOT NULL` 且 `now() > expire_at` 时，视为 `isExpired=true`。
- 撤回自动取消置顶：`pinned=false, pinned_at=NULL`。

## 7. 关键业务规则（MVP）
- 参数校验：
  - `title` 必填，<=200
  - `content_md` 必填
  - `expire_at` 可选；若传入需满足 `expire_at > publish_at`（发布时校验）
- 幂等：
  - 重复发布/撤回/置顶设置相同值应直接成功返回（不重复写入副作用）。
- 删除策略：
  - 软删（`deleted_at`）；阅读回执与附件记录保留。
  - Storage 对象本轮不做物理删除；后续可通过后台任务做清理。
- 附件编辑策略：
  - 覆盖式保存：更新公告时按提交的附件列表覆盖（先清空再重建）。

## 8. 页面结构与交互草图（MVP）

### 8.1 前台（Portal）
- `/notices`：公告列表
  - 搜索：标题关键词
  - 筛选：已读/未读、包含过期（默认不含）
  - 展示：置顶标记、过期标记、发布时间、已读状态
- `/notices/:id`：公告详情
  - 顶部展示标题、发布时间/更新时间、过期提示
  - 正文：Markdown 渲染
  - 附件：列表 + 下载

### 8.2 后台（Console）
- `/console/notices`：公告管理
  - 列表：标题、状态、置顶、发布时间、有效期、更新时间、阅读数、创建者
  - 操作：新建、编辑、发布/撤回、置顶/取消置顶、删除
  - 过滤：关键字、状态、包含过期、（可选）只看我创建
- `/console/notices/new`、`/console/notices/:id/edit`：新建/编辑
  - 表单：标题、正文（富文本所见即所得，落库 Markdown；建议提供“源码模式”切换）、有效期、可见范围选择（全员/角色/部门/岗位）、附件上传

## 9. 验收标准（MVP）
- staff 可创建草稿并设置可见范围/附件/有效期，发布后 user 可在前台列表看到（符合可见性规则）。
- user 进入详情会生成且仅生成 1 条阅读回执，列表正确显示已读/未读与阅读数。
- 置顶公告在列表最前（置顶时间倒序），撤回后自动取消置顶且前台不可见。
- 过期公告默认不出现在列表，`includeExpired=true` 时可见；详情可访问并提示“已过期”。
