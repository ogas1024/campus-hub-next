-- 课程资源分享（专业/课程/资源/负责人/榜单/最佳/积分）
--
-- 【0基础速读】
-- 这个模块不是只有一张“资源表”，而是分成：
-- 1. majors：专业
-- 2. courses：课程，属于专业
-- 3. major_leads：专业负责人，多对多
-- 4. course_resources：资源主体，含审核状态
-- 5. course_resource_bests：最佳推荐
-- 6. course_resource_download_events：下载事件事实表
-- 7. course_resource_score_events：积分事件事实表
--
-- 答辩口径：
-- 主数据、资源主体、事件事实表分层建模，不把所有东西塞进一张大表。
-- 约定：
-- - 仅新增结构与可逆默认数据（角色/权限/配置）；不执行破坏性数据操作
-- - Console 侧访问控制由 BFF 实现；RLS 默认开启但不下发策略（避免直连）

-- 枚举：资源类型。
-- 资源只能是 file 或 link，避免类型字段乱写。
do $$ begin
  create type public.course_resource_type as enum ('file', 'link');
exception
  when duplicate_object then null;
end $$;

-- 枚举：资源状态。
-- draft 草稿、pending 待审核、published 已发布、rejected 已驳回、unpublished 已下架。
do $$ begin
  create type public.course_resource_status as enum ('draft', 'pending', 'published', 'rejected', 'unpublished');
exception
  when duplicate_object then null;
end $$;

-- 枚举：积分事件类型（保证“首次语义”）。
-- approve = 审核通过加分；best = 设为最佳加分。
do $$ begin
  create type public.course_resource_score_event_type as enum ('approve', 'best');
exception
  when duplicate_object then null;
end $$;

-- 【专业表】
-- 专业是课程资源的上层教学主数据。
-- deleted_at 是软删除，用于保留历史。
create table if not exists public.majors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enabled boolean not null default true,
  sort integer not null default 0,
  remark text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

-- 有效专业名称唯一；已软删除历史不参与唯一判断。
create unique index if not exists majors_name_active_uq on public.majors(name) where deleted_at is null;
create index if not exists majors_enabled_idx on public.majors(enabled);

do $$ begin
  create trigger majors_set_updated_at before update on public.majors
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 【专业负责人表】
-- 一个专业可以有多个负责人，一个用户也可以负责多个专业。
-- 所以这里不是在 majors 表里放 leader_id，而是用桥接表表达多对多关系。
create table if not exists public.major_leads (
  major_id uuid not null references public.majors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 复合主键保证：同一个用户不能被重复设置为同一专业负责人。
  primary key (major_id, user_id)
);

create index if not exists major_leads_user_id_idx on public.major_leads(user_id);

-- 【课程表】
-- 课程必须属于某个专业：major_id 外键引用 majors。
-- on delete restrict 表示：如果专业下还有课程，不允许直接物理删除专业。
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  major_id uuid not null references public.majors(id) on delete restrict,
  name text not null,
  code text null,
  enabled boolean not null default true,
  sort integer not null default 0,
  remark text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

-- 课程名不是全局唯一，而是“同一专业下课程名唯一”。
-- 例：不同专业都可能有“数据库系统概论”。
create unique index if not exists courses_major_name_active_uq on public.courses(major_id, name) where deleted_at is null;
create index if not exists courses_major_id_idx on public.courses(major_id);
create index if not exists courses_enabled_idx on public.courses(enabled);

do $$ begin
  create trigger courses_set_updated_at before update on public.courses
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 【课程资源主体表】
-- 一条资源属于某个课程，也保留 major_id 用于按专业过滤和统计。
-- 注意：major_id 是“受控冗余”，后续 0012 迁移会用复合外键保证它和 course_id 一致。
create table if not exists public.course_resources (
  id uuid primary key default gen_random_uuid(),
  major_id uuid not null references public.majors(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  title text not null,
  description text not null,
  resource_type public.course_resource_type not null,
  status public.course_resource_status not null default 'draft',

  -- 文件型资源字段。
  -- file_bucket/file_key 表示文件在对象存储里的位置；
  -- sha256 表示文件内容摘要，用于同课程去重。
  file_bucket text null,
  file_key text null,
  file_name text null,
  file_size integer null,
  sha256 text null,

  -- 外链型资源字段。
  -- link_url 是原始链接，link_url_normalized 是规范化后的链接，用于去重。
  link_url text null,
  link_url_normalized text null,

  -- submitted_at：提交审核时间。
  submitted_at timestamptz null,

  -- 审核信息：谁审核、什么时候审核、审核意见。
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  review_comment text null,

  -- 发布/下架时间。
  published_at timestamptz null,
  unpublished_at timestamptz null,

  -- download_count 是汇总冗余，用于快速排序；
  -- 真实下载明细在 course_resource_download_events 中。
  download_count integer not null default 0,
  last_download_at timestamptz null,

  -- created_by 是资源作者。
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid null references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  -- 下载次数不能为负；文件大小如果填写，也不能为负。
  constraint course_resources_download_count_chk check (download_count >= 0),
  constraint course_resources_file_size_chk check (file_size is null or file_size >= 0),
  -- 初版字段组合约束：
  -- file 类型必须有文件字段且不能有外链字段；
  -- link 类型必须有外链字段且不能有文件字段。
  -- 后续 0005 会升级这个约束，允许 draft 草稿阶段暂缺文件/外链明细。
  constraint course_resources_file_or_link_chk check (
    (
      resource_type = 'file'
      and file_bucket is not null
      and file_key is not null
      and file_name is not null
      and file_size is not null
      and sha256 is not null
      and link_url is null
      and link_url_normalized is null
    )
    or
    (
      resource_type = 'link'
      and link_url is not null
      and link_url_normalized is not null
      and file_bucket is null
      and file_key is null
      and file_name is null
      and file_size is null
      and sha256 is null
    )
  )
);

-- 常见查询索引：
-- status：审核列表
-- major_id/course_id：按专业/课程过滤资源
-- created_by：查作者作品
-- download_count：下载榜排序
create index if not exists course_resources_status_idx on public.course_resources(status);
create index if not exists course_resources_major_id_idx on public.course_resources(major_id);
create index if not exists course_resources_course_id_idx on public.course_resources(course_id);
create index if not exists course_resources_created_by_idx on public.course_resources(created_by);
create index if not exists course_resources_download_count_idx on public.course_resources(download_count);

-- 去重：同课程维度 sha256 / 规范化 URL 唯一（软删不参与）。
-- 文件资源按内容摘要 sha256 去重；外链资源按规范化 URL 去重。
create unique index if not exists course_resources_course_sha256_active_uq
  on public.course_resources(course_id, sha256)
  where deleted_at is null and resource_type = 'file';

create unique index if not exists course_resources_course_link_active_uq
  on public.course_resources(course_id, link_url_normalized)
  where deleted_at is null and resource_type = 'link';

do $$ begin
  create trigger course_resources_set_updated_at before update on public.course_resources
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 【最佳推荐表】
-- 最佳推荐不是简单 is_best 布尔字段，因为还要记录推荐人 best_by 和推荐时间 best_at。
-- resource_id 做主键，表示同一资源最多一条最佳推荐事实。
create table if not exists public.course_resource_bests (
  resource_id uuid primary key references public.course_resources(id) on delete cascade,
  best_by uuid not null,
  best_at timestamptz not null default now()
);

create index if not exists course_resource_bests_best_at_idx on public.course_resource_bests(best_at);

-- 【下载事件表】
-- 这是一张事实表：每下载一次就追加一条记录。
-- 它用于时间窗口统计、审计和排行榜分析。
-- user_id 允许为空并 on delete set null，是为了用户删除后仍保留下载事实。
create table if not exists public.course_resource_download_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.course_resources(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  ip text null,
  user_agent text null
);

-- 下载统计常按资源或时间窗口聚合，所以给 resource_id 和 occurred_at 建索引。
create index if not exists course_resource_download_events_resource_id_idx on public.course_resource_download_events(resource_id);
create index if not exists course_resource_download_events_occurred_at_idx on public.course_resource_download_events(occurred_at);

-- 【积分事件表】
-- 这也是事实表：资源通过审核、被设为最佳时，给作者记一条积分事件。
-- event_type 当前有 approve/best 两种。
-- 用唯一约束保证“同一用户 + 同一资源 + 同一事件类型”只加一次分。
create table if not exists public.course_resource_score_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  major_id uuid not null references public.majors(id) on delete restrict,
  resource_id uuid not null references public.course_resources(id) on delete cascade,
  event_type public.course_resource_score_event_type not null,
  delta integer not null,
  occurred_at timestamptz not null default now(),
  -- 积分必须大于 0。
  constraint course_resource_score_events_delta_chk check (delta > 0),
  -- 防重复加分：同一个作者、同一个资源、同一种事件只能有一条积分记录。
  constraint course_resource_score_events_first_uq unique (user_id, resource_id, event_type)
);

create index if not exists course_resource_score_events_major_id_idx on public.course_resource_score_events(major_id);
create index if not exists course_resource_score_events_user_id_idx on public.course_resource_score_events(user_id);
create index if not exists course_resource_score_events_occurred_at_idx on public.course_resource_score_events(occurred_at);

-- 配置默认值（积分，可在线修改）
insert into public.app_config (key, value)
values
  ('courseResources.score.approveDelta', '5'::jsonb),
  ('courseResources.score.bestDelta', '10'::jsonb)
on conflict (key) do nothing;

-- 角色：major_lead
insert into public.roles (code, name, description)
values ('major_lead', '专业负责人', '负责某些专业的课程资源运营与审核')
on conflict (code) do nothing;

-- 权限字典：课程资源分享（module=resource）
insert into public.permissions (code, description)
values
  ('campus:resource:*', '课程资源分享（全量）'),
  ('campus:resource:major_list', '专业列表/查询'),
  ('campus:resource:major_create', '创建专业'),
  ('campus:resource:major_update', '编辑专业'),
  ('campus:resource:major_delete', '删除专业'),
  ('campus:resource:major_lead_update', '配置专业负责人'),
  ('campus:resource:course_list', '课程列表/查询'),
  ('campus:resource:course_create', '创建课程'),
  ('campus:resource:course_update', '编辑课程'),
  ('campus:resource:course_delete', '删除课程'),
  ('campus:resource:list', '资源列表/查询（管理端）'),
  ('campus:resource:read', '资源详情查看（管理端）'),
  ('campus:resource:review', '资源审核（通过/驳回）'),
  ('campus:resource:offline', '资源下架'),
  ('campus:resource:best', '最佳推荐（设置/取消）'),
  ('campus:resource:stats', '资源统计/榜单查询'),
  ('campus:resource:delete', '资源硬删除（仅删库）')
on conflict (code) do nothing;

-- 角色-权限：major_lead（仅本专业范围由应用层强制过滤）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'campus:resource:course_list',
  'campus:resource:course_create',
  'campus:resource:course_update',
  'campus:resource:course_delete',
  'campus:resource:list',
  'campus:resource:read',
  'campus:resource:review',
  'campus:resource:offline',
  'campus:resource:best',
  'campus:resource:stats'
)
where r.code = 'major_lead'
on conflict do nothing;

-- 角色-权限：admin / super_admin（资源模块全量）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('campus:resource:*')
where r.code in ('admin', 'super_admin')
on conflict do nothing;

-- RLS：新增表启用（默认不开放直连；策略在实现阶段补齐）
alter table public.majors enable row level security;
alter table public.major_leads enable row level security;
alter table public.courses enable row level security;
alter table public.course_resources enable row level security;
alter table public.course_resource_bests enable row level security;
alter table public.course_resource_download_events enable row level security;
alter table public.course_resource_score_events enable row level security;
