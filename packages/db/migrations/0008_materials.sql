-- 收集引擎（Collect Engine）+ 材料收集（materials）试点
-- 约定：
-- - 仅新增结构与可逆默认数据（权限/授权）；不执行破坏性数据操作
-- - 提交文件默认敏感：由 BFF 鉴权后签名下载；撤回会物理删除文件对象
-- - Console 侧访问控制由 BFF 实现；RLS 默认开启但不下发策略（避免直连）
-- - module 单词化（用于 RBAC/DataScope），如：material

-- 枚举：任务状态
do $$ begin
  create type public.collect_task_status as enum ('draft', 'published', 'closed');
exception
  when duplicate_object then null;
end $$;

-- 枚举：可见范围类型（沿用公告/问卷口径）
do $$ begin
  create type public.collect_scope_type as enum ('role', 'department', 'position');
exception
  when duplicate_object then null;
end $$;

-- 枚举：提交处理状态
do $$ begin
  create type public.collect_submission_status as enum ('pending', 'complete', 'need_more', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

-- 枚举：任务项类型（MVP 仅实现 file；后续可扩展 text/single/multi 等）
do $$ begin
  create type public.collect_item_kind as enum ('file');
exception
  when duplicate_object then null;
end $$;

-- 枚举：关联来源类型（MVP 仅实现 notice；后续可扩展）
do $$ begin
  create type public.collect_source_type as enum ('notice');
exception
  when duplicate_object then null;
end $$;

-- 任务（按 module 隔离）
create table if not exists public.collect_tasks (
  id uuid primary key default gen_random_uuid(),
  module text not null,

  title text not null,
  description_md text not null default '',
  status public.collect_task_status not null default 'draft',

  source_type public.collect_source_type null,
  source_id uuid null,

  visible_all boolean not null default true,
  max_files_per_submission integer not null default 10,
  due_at timestamptz null,

  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid null references auth.users(id) on delete set null,

  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint collect_tasks_module_chk check (module ~ '^[a-z][a-z0-9]*$'),
  constraint collect_tasks_source_pair_chk check (
    (source_type is null and source_id is null) or (source_type is not null and source_id is not null)
  ),
  constraint collect_tasks_max_files_chk check (max_files_per_submission >= 1 and max_files_per_submission <= 50)
);

-- 同一来源对象在同一 module 下最多绑定 1 个“未删除”的任务（满足 notice ↔ material 1:1）
create unique index if not exists collect_tasks_module_source_active_uq
on public.collect_tasks(module, source_type, source_id)
where source_id is not null and deleted_at is null;

create index if not exists collect_tasks_module_idx on public.collect_tasks(module);
create index if not exists collect_tasks_status_idx on public.collect_tasks(status);
create index if not exists collect_tasks_created_by_idx on public.collect_tasks(created_by);
create index if not exists collect_tasks_archived_at_idx on public.collect_tasks(archived_at);

do $$ begin
  create trigger collect_tasks_set_updated_at before update on public.collect_tasks
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 可见范围（仅 source 为空时生效；有关联来源时继承来源可见范围）
create table if not exists public.collect_task_scopes (
  task_id uuid not null references public.collect_tasks(id) on delete cascade,
  scope_type public.collect_scope_type not null,
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (task_id, scope_type, ref_id)
);

create index if not exists collect_task_scopes_task_id_idx on public.collect_task_scopes(task_id);

-- 任务项（MVP：文件题，可挂模板文件）
create table if not exists public.collect_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.collect_tasks(id) on delete cascade,
  kind public.collect_item_kind not null default 'file',

  title text not null,
  description text null,
  required boolean not null default false,
  sort integer not null default 0,

  template_file_key text null,
  template_file_name text null,
  template_content_type text null,
  template_size integer null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collect_items_task_id_idx on public.collect_items(task_id);
create index if not exists collect_items_kind_idx on public.collect_items(kind);
create index if not exists collect_items_sort_idx on public.collect_items(sort);

do $$ begin
  create trigger collect_items_set_updated_at before update on public.collect_items
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 提交（一人一份；覆盖式提交；撤回会物理删除文件对象并清空文件记录）
create table if not exists public.collect_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.collect_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,

  submitted_at timestamptz null,
  withdrawn_at timestamptz null,

  status public.collect_submission_status not null default 'pending',
  assignee_user_id uuid null references auth.users(id) on delete set null,
  student_message text null,
  staff_note text null,

  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists collect_submissions_task_user_uq on public.collect_submissions(task_id, user_id);
create index if not exists collect_submissions_task_id_idx on public.collect_submissions(task_id);
create index if not exists collect_submissions_user_id_idx on public.collect_submissions(user_id);
create index if not exists collect_submissions_status_idx on public.collect_submissions(status);
create index if not exists collect_submissions_submitted_at_idx on public.collect_submissions(submitted_at);
create index if not exists collect_submissions_assignee_user_id_idx on public.collect_submissions(assignee_user_id);

do $$ begin
  create trigger collect_submissions_set_updated_at before update on public.collect_submissions
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 提交文件（归属任务项）
create table if not exists public.collect_submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.collect_submissions(id) on delete cascade,
  item_id uuid not null references public.collect_items(id) on delete restrict,
  file_key text not null,
  file_name text not null,
  content_type text not null,
  size integer not null,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists collect_submission_files_submission_id_idx on public.collect_submission_files(submission_id);
create index if not exists collect_submission_files_item_id_idx on public.collect_submission_files(item_id);
create index if not exists collect_submission_files_created_at_idx on public.collect_submission_files(created_at);

-- 权限字典：材料收集（module=material）
insert into public.permissions (code, description)
values
  ('campus:material:list', '材料收集任务列表/查询（管理端）'),
  ('campus:material:read', '材料收集任务详情/提交查看（管理端）'),
  ('campus:material:create', '创建材料收集任务（草稿）'),
  ('campus:material:update', '编辑材料收集任务（草稿）'),
  ('campus:material:delete', '删除材料收集任务（软删）'),
  ('campus:material:publish', '发布材料收集任务'),
  ('campus:material:close', '关闭材料收集任务'),
  ('campus:material:archive', '归档材料收集任务'),
  ('campus:material:process', '处理材料收集提交（分配/改状态/批量）'),
  ('campus:material:export', '导出材料收集 ZIP'),
  ('campus:material:manage', '材料收集全量管理')
on conflict (code) do nothing;

-- 角色-权限：staff（默认仅操作自己创建的任务，由应用层做资源级授权）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'campus:material:list',
  'campus:material:read',
  'campus:material:create',
  'campus:material:update',
  'campus:material:delete',
  'campus:material:publish',
  'campus:material:close',
  'campus:material:archive',
  'campus:material:process',
  'campus:material:export'
)
where r.code = 'staff'
on conflict do nothing;

-- 角色-权限：admin / super_admin（全量）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'campus:material:list',
  'campus:material:read',
  'campus:material:create',
  'campus:material:update',
  'campus:material:delete',
  'campus:material:publish',
  'campus:material:close',
  'campus:material:archive',
  'campus:material:process',
  'campus:material:export',
  'campus:material:manage'
)
where r.code in ('admin', 'super_admin')
on conflict do nothing;

-- RLS：新增表启用（默认不开放直连；策略在实现阶段补齐）
alter table public.collect_tasks enable row level security;
alter table public.collect_task_scopes enable row level security;
alter table public.collect_items enable row level security;
alter table public.collect_submissions enable row level security;
alter table public.collect_submission_files enable row level security;
