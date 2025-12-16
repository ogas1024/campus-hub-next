### 总原则
- 本仓库为 **campus-hub-next**，是一个全新实现的校园服务平台，与 `campus-hub-ruoyi` 平行存在；旧仓库只作为业务参考，不再改动。
- 所有新文件统一使用 UTF-8（无 BOM），代码注释与文档默认使用中文。
- 以「业务模块」为粒度推进（课程资源分享 / 功能房预约 / 通知公告 / 数字图书馆 / 失物招领……），每次迭代做到：**可运行、可测试、可部署**。
- 坚持「抽象层优先」：数据 / 鉴权 / 文件 / AI / 配置 / 日志 / 外部 HTTP 调用都通过 Adapter 或 Service 封装，业务代码不直接依赖具体云厂商或 SDK。
- 尽量在 Vercel / Supabase 免费额度内完成开发与演示，不引入必须付费才能正常使用的基础设施。
- 工作空间仅限于 `campus-hub-next` 内，禁止在项目根目录添加/编辑/删除文件，`campus-hub-ruoyi` 作为功能和需求上的参考


---

### 平台定位与范围

- 本仓库 `campus-hub-next` 只负责 **学生生活子平台**（课程资源分享 / 功能房预约 / 通知公告 / 数字图书馆 / 失物招领 等），面向日常在校学生与相关管理角色。
- 未来还会有其他大系统（如 **招生选拔系统**、**党建管理系统** 等），它们可以采用相同的技术栈与工作流，但推荐作为 **独立的 bounded context / 独立应用或仓库** 存在。
- 一体化平台层面（未来可以单独设计）建议统一的公共能力包括：
  - 身份与权限中心（用户 / 角色 / 权限矩阵 / SSO）
  - 统一 UI 设计语言与组件库（导航布局、配色、表格与表单模式）
  - 日志与审计、通知与消息（站内信 / 邮件 / 短信 / Webhook）
- 本项目在命名和设计上默认站在“全院平台”的视角：
  - 权限前缀使用 `campus:<module>:<op>`，例如 `campus:facility:approve`，未来其他子系统可复用同一前缀体系。
  - 实体命名尽量保持中性与可复用（如 `user` / `major` / `department`），避免写死为“只服务某一个子系统”的叫法。
- 当前阶段的原则：**在不影响开发效率的前提下，避免做出明显阻碍未来集成的决定**，例如：
  - 不在学生生活系统里偷偷实现“招生专用”的逻辑；
  - 不在 DB 里混杂其他大系统的表，而是保持子平台域内干净。


---

### 角色分工
- **用户（你）**
  - 提出与确认业务需求、角色权限、边界场景。
  - 在 Supabase 控制台创建项目、配置环境变量、初始化数据库实例（如有需要）。
  - 在 Vercel 上关联仓库、配置环境变量、触发构建与管理域名。
  - 在浏览器或 API 工具中完成最终验收；执行 `git commit` / 分支合并。

- **Codex Agent（我）**
  - 负责架构设计、表结构与迁移设计（Drizzle schema + migration）、API 设计与文档。
  - 编写 Next.js 前后端代码（页面 / Route Handlers / Service / Repository）。
  - 编写基础测试与自检脚本；撰写模块设计文档 / API 文档 / 测试指南。
  - 提示如何在 Supabase / Vercel 等控制台完成必要配置。

---

### 技术栈概览
- **Web & BFF**：Next.js 16（App Router）+ React 19 + TypeScript
- **样式 & UI**：**Tailwind CSS 4**，**shadcn/ui** + Radix
- **数据库**：Supabase Postgres（免费层）+ Drizzle ORM（schema + migration + 类型）
- **鉴权**：Supabase Auth（邮箱/密码或 Magic Link），BFF 封装 `getCurrentUser()`
- **文件存储**：Supabase Storage（资源 / 电子书 / 图片），通过 StorageAdapter 封装
- **AI**：OpenAI 兼容协议（优先使用你的 new-api 中转），封装在 `aiClient` 中
- **工具链**：pnpm workspace、TypeScript、ESLint/Biome（可选）、Vitest / Playwright（可选）

---

### 目录结构与运行方式

- 仓库根目录：
  - `AGENTS.md`：本说明。
  - `docs/`：需求、API 文档、模块报告等。
  - `app/`：Next.js App Router（页面与 Route Handlers）。
    - `app/(auth)/**`：登录 / 注册 / 重置密码等页面。
    - `app/(portal)/**`：面向普通用户的前台页面（功能房预约、资源浏览等）。
    - `app/(console)/console/**`：面向管理角色的后台页面（审核、统计、配置等），实际路由前缀为 `/console/...`。
    - `app/api/**/route.ts`：BFF API 与 AI 接口（REST / JSON）。
  - `components/`：通用 React 组件（表格、表单、布局等），前台/后台复用。
  - `lib/`：非 UI 代码（`config` / `auth` / `aiClient` / `StorageAdapter` / 各模块 `service` 与 `repository` 等）。
  - `packages/db/`：Drizzle ORM schema、迁移与种子数据（跨项目可复用的数据库层）。
  - `packages/config/`：共享配置（tsconfig、lint 配置、测试配置等），为未来其他子系统预留。
  - `public/`：静态资源（图标、占位图、公共文件等）。

- 运行与构建：
  - 开发：`pnpm dev`
  - 构建：`pnpm build`
  - 生产启动（本地）：`pnpm start`
  - 依赖安装：`pnpm install`


---

### 视图分层：前台 / 后台
- **前台（portal）**
  - URL 示例：`/`、`/resources`、`/facilities`、`/library`、`/lost-and-found`。
  - 面向普通学生 / 校园用户。
  - 功能：浏览资源、提交预约、发布/查看失物、阅读公告等。

- **后台（console）**
  - URL 示例：`/console`、`/console/facilities`、`/console/resources`、`/console/notices`。
  - 面向专业负责人、图书管理员、学生工作者、系统管理员等管理角色。
  - 功能：审核预约、审核资源、管理公告、维护图书与查看统计等。

> 是否可以访问 `/console/**` 由当前用户角色 / 权限决定，而不是由 URL 名字决定。

---

### 抽象层约定
- **数据层（DB + Repository）**
  - 所有表结构使用 Drizzle schema 定义，迁移使用 drizzle-kit 管理。
  - 业务代码通过 Repository 访问数据，避免在 Route Handler 中直接写 SQL。
  - 不直接使用 Supabase RPC；Supabase 主要提供 Postgres 连接能力。

- **鉴权层（AuthProvider）**
  - 封装一个 `AuthProvider` 接口，至少包含：
    - `getCurrentUser(req): Promise<AppUser | null>`
    - `requireUser(req): Promise<AppUser>`（未登录抛 401）
    - `requirePerm(req, perm: string): Promise<AppUser>`（无权限抛 403）
  - 起步实现基于 Supabase Auth；未来如需替换 Lucia/Auth.js，只改适配实现。

- **文件存储层（StorageAdapter）**
  - 抽象接口示例：
    - `upload(file, key?) => { key, url }`
    - `getUrl(key) => url`
    - `remove(key)`
  - 起步实现使用 Supabase Storage；未来可替换为 R2 / S3 / MinIO，只需更换 Adapter。

- **AI 层（aiClient）**
  - 使用 OpenAI 兼容协议：统一通过 `AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL` 调用。
  - 对外仅暴露如 `streamChat(messages)` 等函数；内部使用 Vercel AI SDK 或 OpenAI SDK。
  - 所有 AI 调用走 `aiClient`，禁止在业务代码中直接拼 HTTP 请求访问 AI 接口。

- **配置层（config）**
  - 使用 zod 校验环境变量，集中在 `lib/config.ts`（或等价模块）。
  - 业务代码不直接读 `process.env`，统一通过 `config` 模块获取。

- **日志层（logger）**
  - 定义 `logger.info / logger.error` 等基本方法，默认输出到 `console`。
  - 将来接入 Sentry / Axiom 只需修改 logger 实现。

- **外部 HTTP 客户端**
  - 任意外部服务调用都封装为独立模块，如 `lib/http/externalBookApi.ts`。
  - 避免在业务代码各处写散乱的 `fetch(https://...)`。

---

### API 设计规范（Next.js Route Handlers）
- **统一前缀**
  - 所有后端接口统一以 `/api` 开头。

- **资源型（REST 风格）**
  - 资源名尽量与领域名一致，例如：
    - `facilities`（功能房）
    - `reservations`（预约）
    - `resources`（课程资源）
    - `notices`（通知公告）
    - `library`（数字图书）
    - `lost-found`（失物招领）
  - 标准形式：
    - `GET /api/<resource>`：列表（支持分页 / 过滤）
    - `GET /api/<resource>/:id`：详情
    - `POST /api/<resource>`：新增
    - `PUT /api/<resource>/:id` 或 `PATCH /api/<resource>/:id`：修改
    - `DELETE /api/<resource>/:id`：删除

- **当前用户视角**
  - 如需“只看自己的”数据，可以使用 `/api/me/<resource>`：
    - `GET /api/me/reservations`：当前用户的预约
    - `GET /api/me/resources`：当前用户上传的资源

- **动作型（状态变更等）**
  - 状态、审核等动作挂在具体资源下，使用语义化动作名：
    - `POST /api/reservations/:id/approve`：审核通过预约
    - `POST /api/reservations/:id/reject`：驳回预约
    - `POST /api/resources/:id/publish`：发布课程资源
    - `POST /api/resources/:id/unpublish`：下架课程资源

- **后台专用接口（可选）**
  - 如确有需要，可为后台特有查询 / 批量操作提供 `/api/console/**` 前缀，例如：
    - `GET /api/console/reservations`：管理端高级筛选预约
  - 是否能访问 `/api/console/**` 由权限控制决定，不依赖具体角色名称。

---

### 角色与权限
- **角色建议**
  - `user`：普通校园用户
  - `staff`：学生工作者（发布公告等）
  - `librarian`：图书管理员
  - `major_lead`：专业负责人
  - `admin`：管理员
  - `super_admin`：系统超管

- **权限标识建议**
  - 采用：`campus:<module>:<op>` 格式，例如：
    - `campus:facility:list`
    - `campus:facility:approve`
    - `campus:resource:publish`
  - 前端按钮级权限控制与后端校验保持一致。

---

### 模块化工作流（文档驱动 · 细粒度）
> 每个“模块”（如功能房预约、课程资源分享）都按照以下阶段推进；每个阶段都有对应文档产物和进入/退出条件，用来控制 Vibe Coding 的节奏。

1. 立项与范围冻结（Scope）
   - 产物：`docs/requirements/<模块>.md` 的「概览」与「范围说明」小节。
   - 内容：
     - 模块要解决的问题（Problem Statement）。
     - 涉及角色（普通用户 / 管理角色）及各自能做什么。
     - 必须实现的 MVP 能力（列表 / 创建 / 审核 / 状态流转 / 基本统计）。
     - 明确不在本轮范围内的功能（Out of Scope）。
   - 退出条件：你确认“这轮只做这些”，并在文档中标记 MVP 范围。

2. 领域建模与用例（Domain & Use Cases）
   - 产物：`docs/requirements/<模块>.md` 中的：
     - 领域模型（实体 / 属性 / 关系），可用简单 ER 图或文字列表描述。
     - 关键用例列表（前台 / 后台分别列出）：每条包含“作为谁 / 在哪 / 做什么 / 为了什么”。
   - 退出条件：所有表结构、接口、页面都能映射到这些实体和用例，没有“黑盒功能”。

3. 数据建模与迁移设计（DB Schema & Migration）
   - 产物：
     - `packages/db/src/schema/<模块>.ts`：Drizzle schema（表、字段、索引、约束、审计字段）。
     - 迁移脚本：通过 drizzle-kit 生成的 migration 文件；在文档中简要说明变更意图。
   - 约束：
     - 关键业务约束用唯一键或检查约束体现（如预约 `(facility_id, time_slot)` 唯一）。
   - 退出条件：迁移在 Supabase 上成功执行，`SELECT` 检查结构与预期一致。

4. API 契约设计（API Contract First）
   - 产物：`docs/api/<模块>.md`，按接口维度编写：
     - 路径、方法、权限（需要哪些角色 / 权限码）。
     - 请求参数（query / body）、响应结构（包含错误结构）。
     - 示例请求 / 响应 JSON。
   - 要求：
     - API 命名遵循上文约定（`/api/<resource>`、`/api/me/<resource>`、`/api/console/<resource>`）。
   - 退出条件：API 文档足够清晰，可以据此直接写前端调用与后端 Handler，无需口头补充。

5. 后端设计与实现（BFF + Service + Repository）
   - 产物：
     - `app/api/<resource>/route.ts` 及子路由：解析请求、调用 Service、返回统一响应。
     - `lib/services/<模块>Service.ts`：封装业务用例（如 `createReservation`、`approveReservation`）。
     - `lib/repositories/<模块>Repo.ts`：封装数据访问。
   - 要求：
     - Route Handler 不直接访问数据库，不包含复杂业务分支。
     - Service 中体现权限检查 / 状态流转 / 幂等控制。
   - 退出条件：局部测试通过，主要接口在本地工具（Postman / Apifox 等）中能跑通 happy path。

6. 前端交互设计（Page & UX 草图）
   - 产物：
     - `docs/requirements/<模块>.md` 中增加「页面结构与交互草图」小节，可以是：
       - 文本描述：页面有哪些区域、按钮、表格列、筛选条件。
       - 或简单草图 / 线框图（不用很正式，只要帮你记住思路）。
   - 退出条件：你对前台 `/...` 和后台 `/console/...` 需要出现哪些控件、入口、按钮有清晰认知。

7. 前端实现（Portal / Console）
   - 产物：
     - `app/(portal)/<module>/page.tsx`：前台视图（列表 / 表单 / 详情）。
     - `app/(console)/console/<module>/page.tsx`：后台视图（审核 / 管理）。
     - 必要的 UI 组件与 hooks：放在 `components/`、`features/` 中模块化封装。
   - 要求：
     - 所有网络请求统一通过封装好的 API 调用函数（如 `lib/api/<module>.ts`），组件内部不直接写裸 `fetch`。
   - 退出条件：主要用户流程在浏览器中可以无报错走完（包含错误提示和加载状态）。

8. 测试与质量检查（Testing & QA）
   - 产物：
     - 后端：针对 Service / Repository / 关键 Handler 的 Vitest 测试（至少覆盖成功 / 参数错误 / 权限不足三类场景）。
     - 前端：关键页面或组件的最小测试（或详细的手工测试步骤文档）。
   - 退出条件：
     - 自动测试（如有）全部通过。
     - 手工测试清单执行完毕，无严重缺陷。

9. 文档收束与报告（Documentation & Report）
   - 产物：
     - 更新后的 `docs/requirements/<模块>.md`（与实际实现保持一致）。
     - `docs/api/<模块>.md`：反映最终接口形态。
     - `docs/report/<模块>.md`：包含领域模型、流程图（Mermaid）、权限矩阵、已知限制与后续计划。
   - 退出条件：任何人只看文档，不看代码，也能大致理解模块在做什么、如何交互。

10. 提交与回顾（Commit & Review）
   - 产物：一次或多次符合 Conventional Commits 规范的提交。
   - 要求：
     - 每个 commit 尽量保持原子性，便于回滚和 code review。
     - 提交前对照 DoD 检查一遍，确认满足条件；必要时在报告中记录本轮遗留与下一步计划。

---

### Definition of Done（模块完成标准）
- 表结构与迁移已在 Supabase 中执行并验证。
- API 按规范实现，覆盖成功 / 参数错误 / 权限错误等基本场景。
- 前台与后台页面关键流程可操作，无明显 UX 问题（至少有加载 / 错误提示）。
- 文档（需求 / API / 报告）更新到位。
- 有最小测试或明确的手工测试用例说明。

---

### Git 工作流（完整 · 文档驱动 · 原子提交）

目标：把 Git 当成“时间轴 + 实验记录本”，每个模块都有清晰的演进历史；任何一次改动都能从 commit 里看出动机、细节和测试情况。

#### 1. 分支模型

* `main`
  始终保持可部署、可演示。
  只接受来自 `dev` 或 hotfix 分支的合并，不在 `main` 上直接开发。

* `dev`
  日常集成分支，所有新功能先合并到 `dev`，稳定后再合并到 `main`。

* 功能分支（推荐）
  `feat/<module>/<short-desc>`，例如：

  * `feat/reservation/mvp`
  * `feat/resource/review-flow`
    bug 修复分支：`fix/<module>/<short-desc>`

基础流程：

```bash
# 同步最新开发分支
git checkout dev
git pull origin dev

# 新建功能分支
git checkout -b feat/reservation/mvp

# 开发若干原子 commit ...

# 开发结束后合并回 dev
git checkout dev
git pull origin dev          # 保持最新
git merge --no-ff feat/reservation/mvp
git push origin dev

# 可选：删除功能分支
git branch -d feat/reservation/mvp
git push origin --delete feat/reservation/mvp
```

#### 2. 原子提交原则（“我能不能 commit？”）

只有满足至少一个条件时才提交：

完成一个最小但完整的功能单元（例如：某个接口 + 基本校验）。
修复一个明确的 bug。
完成一次结构性重构（不改变外部行为）。
完成一份文档或测试的有意义更新。

提交前自查：

当前改动能用一句话概括吗？
基本检查（至少 pnpm lint）不会直接报炸吗？
这个改动如果单独回滚，会不会破坏其他提交？

#### 3. Commit Message 头部规范

采用 Conventional Commits：

```
<type>(<scope>): <subject>
```

type：
feat：新增功能
fix：缺陷修复
refactor：重构（不改外部行为）
docs：文档（requirements / api / report / README 等）
test：测试（新增或修改测试）
chore：工具链、配置、依赖等
style：纯样式 / 格式

scope：模块或范围，如：reservation、resource、notice、auth、db、ai、docs。
subject：简短中文描述，建议 ≤ 50 字符，动词开头。

示例：

feat(reservation): 实现功能房预约创建与列表接口
fix(auth): 修复 Supabase 会话过期后用户状态未刷新问题
docs(requirements): 补充功能房预约的领域模型与用例
refactor(db): 抽离公共审计字段到基础 schema

#### 4. Commit Body 写什么

何时写 body？

只要涉及业务逻辑、接口、数据结构变更，或较大重构，建议都写 body。

推荐模板：

```
<简短动机或背景，1–3 行>

### 变更内容
- 新增：
  - ...
- 修改：
  - ...
- 移除：
  - ...

### 风险与影响
- ...

### 测试
- [x] pnpm lint
- [ ] pnpm test
- [x] 手工：在本地通过 /reservations 完成创建/审核/删除流程
```

撰写 body 时，优先按照“逻辑变更”分组，而不是简单按文件罗列；动机部分说明为什么要做，而不是重复“我改了什么”。

#### 5. 模块开发中的典型提交拆分

以“功能房预约模块”为例的一组合理提交：

文档与需求：
docs(reservation): 初版需求说明与范围定义
docs(reservation): 补充领域模型与关键用例

数据层：
feat(db-reservation): 定义预约相关表的 Drizzle schema
chore(db): 生成并应用预约模块迁移脚本

API 与后端：
docs(api-reservation): 列出预约模块 API 契约
feat(reservation): 实现创建与列表接口的 Route Handlers 与 Service
test(reservation): 添加预约创建/列表的基础测试

前端：
feat(reservation-portal): 实现前台预约列表与创建页面
feat(reservation-console): 实现后台预约审核页面
refactor(ui): 抽离通用表格与表单组件

收尾：
docs(report-reservation): 补充模块报告与流程图
chore(config): 调整 lint/test 配置以覆盖新模块

#### 6. 合并策略与历史整理

功能分支开发过程中，同步 dev 建议使用 rebase：

```bash
git checkout feat/reservation/mvp
git fetch origin
git rebase origin/dev
```

合并回 dev：

如果功能分支内 commit 粒度清晰：

```bash
git checkout dev
git merge --no-ff feat/reservation/mvp
```

如中间 commit 过碎，可先在分支上 `git rebase -i dev` 清理，再合并。

合并后的“总括信息”：

如果使用 squash 合并，可以在合并时写一条总结性的 message：

头：`feat(reservation): 完整实现功能房预约模块 MVP`
body 中按“新增 / 修改 / 移除 / 风险 / 测试”结构简要归纳本分支的全部工作。

#### 7. 与文档驱动工作流的对应

需求 / 领域模型（模块工作流步骤 1–2）：
对应 `docs(requirements-*)` 提交。

表结构与迁移（步骤 3）：
对应 `feat(db-*)`、`chore(db)` 提交。

API 契约与后端（步骤 4–5）：
对应一组 `docs(api-*)`、`feat(<module>)`、`test(<module>)` 提交。

前端交互与页面（步骤 6–7）：
对应 `docs(requirements-*)`（草图）、`feat(<module>-portal)`、`feat(<module>-console)` 提交。

测试与报告（步骤 8–9）：
对应 `test(<module>)`、`docs(report-<module>)` 提交。

提交与回顾（步骤 10）：
对应功能分支合并前的历史整理与最终总结性 commit。



---

### MCP 调用规则

- 为 Codex 提供3项 MCP 服务（Sequential Thinking、Context7）的选择与调用规范，控制查询粒度、速率与输出格式，保证可追溯与安全。

#### 全局策略

- 工具选择：根据任务意图选择最匹配的 MCP 服务；避免无意义并发调用。
- 结果可靠性：默认返回精简要点 + 必要引用来源；标注时间与局限。
- 单轮单工具：每轮对话最多调用 1 种外部服务；确需多种时串行并说明理由。
- 最小必要：收敛查询范围（tokens/结果数/时间窗/关键词），避免过度抓取与噪声。
- 可追溯性：统一在答复末尾追加“工具调用简报”（工具、输入摘要、参数、时间、来源/重试）。
- 安全合规：默认离线优先；外呼须遵守 robots/ToS 与隐私要求，必要时先征得授权。
- 降级优先：失败按“失败与降级”执行，无法外呼时提供本地保守答案并标注不确定性。
- 冲突处理：遵循“冲突与优先级”的顺序，出现冲突时采取更保守策略。


#### Sequential Thinking（规划分解）

- 触发：分解复杂问题、规划步骤、生成执行计划、评估方案。
- 输入：简要问题、目标、约束；限制步骤数与深度。
- 输出：仅产出可执行计划与里程碑，不暴露中间推理细节。
- 约束：步骤上限 6-10；每步一句话；可附工具或数据依赖的占位符。


#### Context7（技术文档知识聚合）

- 触发：查询 SDK/API/框架官方文档、快速知识提要、参数示例片段。
- 流程：先 resolve-library-id；确认最相关库；再 get-library-docs。
- 主题与查询：提供 topic/关键词聚焦；tokens 默认 5000，按需下调以避免冗长（示例 topic：hooks、routing、auth）。
- 筛选：多库匹配时优先信任度高与覆盖度高者；歧义时请求澄清或说明选择理由。
- 输出：精炼答案 + 引用文档段落链接或出处标识；标注库 ID/版本；给出关键片段摘要与定位（标题/段落/路径）；避免大段复制。
- 限制：网络受限或未授权不调用；遵守许可与引用规范。
- 失败与回退：无法 resolve 或无结果时，请求澄清或基于本地经验给出保守答案并标注不确定性。
- 无 Key 策略：可直接调用；若限流则提示并降级到 DuckDuckGo（优先官方站点）。


#### Fetch（实时内容检索与验证）

* 触发：需要获取最新动态、新闻、市场数据、实时网页或官方更新。
* 输入：查询主题、关键词、时间范围、域名或来源偏好（如仅限官方或学术站点）。
* 输出：返回结构化摘要 + 来源链接（含域名与时间）；不直接粘贴整页内容。
* 过滤与去噪：优先权威与原创内容；过滤聚合站、广告页与社交媒体低信度来源。
* 约束：单次查询最多抓取前 3–5 条可信结果；tokens 默认 ≤4000。
* 降级策略：若外呼失败或超时，返回最近缓存或说明“离线回答，可能过期”。
* 安全与许可：遵守 robots.txt；不调用受限 API 或需登录内容


#### Serena（语义理解与情境调谐）

* 触发：需要对长对话、用户意图、情绪或上下文进行语义抽象、总结、角色调谐或语气调整。
* 输入：当前对话片段、意图说明或需调优的语气/目标。
* 输出：返回高层语义结构（如“问题类型”、“情绪基调”、“潜在意图”）及推荐的应答策略；不泄露原始隐私内容。
* 约束：仅分析必要上下文，不做额外联网调用；输出长度 ≤800 tokens。
* 用例：语气缓和、角色重心调整、多轮上下文压缩、摘要提炼。
* 失败与回退：若上下文不足或内容含糊，提示用户补充信息而非猜测。

#### Supabase (数据库与鉴权)

- 当你需要对Supabase进行操作配置，可以使用 Supabse mcp进行配置，我已授权

#### Vercel （发布）

- 当你需要对发布进行调整，可以使用此mcp

#### Gihub （版本控制）

- 当你需要对Github远端仓库进行调整，可以使用此mcp，但是务必经过我授权
