-- 通用扩展
create extension if not exists "pgcrypto";

-- 枚举：用户状态
do $$ begin
  create type public.profile_status as enum (
    'active',
    'disabled',
    'banned',
    'pending_approval',
    'pending_email_verification'
  );
exception
  when duplicate_object then null;
end $$;

-- 枚举：公告状态
do $$ begin
  create type public.notice_status as enum ('draft', 'published', 'retracted');
exception
  when duplicate_object then null;
end $$;

-- 枚举：公告可见范围类型
do $$ begin
  create type public.notice_scope_type as enum ('role', 'department', 'position');
exception
  when duplicate_object then null;
end $$;

-- 组织：部门
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists departments_parent_id_idx on public.departments(parent_id);

-- 组织：岗位
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists positions_name_uq on public.positions(name);

-- 角色
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists roles_code_uq on public.roles(code);

-- 权限码
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text null,
  created_at timestamptz not null default now()
);

create unique index if not exists permissions_code_uq on public.permissions(code);

-- 用户扩展信息（主键 = auth.users.id）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text null,
  student_id text not null,
  avatar_url text null,
  status public.profile_status not null default 'pending_approval',
  department_id uuid null references public.departments(id) on delete set null,
  last_login_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_student_id_format_chk check (student_id ~ '^[0-9]{16}$')
);

create unique index if not exists profiles_username_uq on public.profiles(username);
create unique index if not exists profiles_student_id_uq on public.profiles(student_id);
create index if not exists profiles_status_idx on public.profiles(status);
create index if not exists profiles_department_id_idx on public.profiles(department_id);

-- 用户-岗位（多对多）
create table if not exists public.user_positions (
  user_id uuid not null references auth.users(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, position_id)
);

create index if not exists user_positions_user_id_idx on public.user_positions(user_id);

-- 用户-角色
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists user_roles_user_id_idx on public.user_roles(user_id);

-- 角色-权限
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create index if not exists role_permissions_role_id_idx on public.role_permissions(role_id);

-- 公告主体
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content_md text not null,
  status public.notice_status not null default 'draft',
  visible_all boolean not null default false,
  pinned boolean not null default false,
  pinned_at timestamptz null,
  publish_at timestamptz null,
  expire_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid null references auth.users(id) on delete set null,
  edit_count integer not null default 0,
  read_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists notices_status_idx on public.notices(status);
create index if not exists notices_publish_at_idx on public.notices(publish_at);
create index if not exists notices_pinned_at_idx on public.notices(pinned_at);
create index if not exists notices_created_by_idx on public.notices(created_by);

-- 公告可见范围（OR 逻辑：role/department/position 命中任一即可）
create table if not exists public.notice_scopes (
  notice_id uuid not null references public.notices(id) on delete cascade,
  scope_type public.notice_scope_type not null,
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (notice_id, scope_type, ref_id)
);

create index if not exists notice_scopes_notice_id_idx on public.notice_scopes(notice_id);

-- 公告附件（元数据）
create table if not exists public.notice_attachments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  file_key text not null,
  file_name text not null,
  content_type text not null,
  size integer not null,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists notice_attachments_notice_id_idx on public.notice_attachments(notice_id);

-- 阅读回执（去重计数）
create table if not exists public.notice_reads (
  notice_id uuid not null references public.notices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);

create index if not exists notice_reads_notice_id_idx on public.notice_reads(notice_id);
create index if not exists notice_reads_user_id_idx on public.notice_reads(user_id);

-- 通用 updated_at 维护（触发器）
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  create trigger roles_set_updated_at before update on public.roles
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger departments_set_updated_at before update on public.departments
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger positions_set_updated_at before update on public.positions
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger notices_set_updated_at before update on public.notices
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 种子数据：基础角色
insert into public.roles (code, name, description)
values
  ('user', '普通用户', '默认角色'),
  ('staff', '工作人员', '可发布公告等'),
  ('admin', '管理员', '管理端管理员'),
  ('super_admin', '超级管理员', '系统最高权限')
on conflict (code) do nothing;

-- 种子数据：通知公告权限
insert into public.permissions (code, description)
values
  ('campus:notice:list', '公告管理端列表/查询'),
  ('campus:notice:create', '创建公告'),
  ('campus:notice:update', '编辑公告'),
  ('campus:notice:delete', '删除公告（软删）'),
  ('campus:notice:publish', '发布/撤回公告'),
  ('campus:notice:pin', '置顶/取消置顶'),
  ('campus:notice:manage', '公告全量管理')
on conflict (code) do nothing;

-- 角色-权限：staff（操作自己创建的公告由应用层做“资源级授权”）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'campus:notice:list',
  'campus:notice:create',
  'campus:notice:update',
  'campus:notice:delete',
  'campus:notice:publish',
  'campus:notice:pin'
)
where r.code = 'staff'
on conflict do nothing;

-- 角色-权限：admin
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'campus:notice:list',
  'campus:notice:create',
  'campus:notice:update',
  'campus:notice:delete',
  'campus:notice:publish',
  'campus:notice:pin',
  'campus:notice:manage'
)
where r.code = 'admin'
on conflict do nothing;

-- 角色-权限：super_admin（MVP：同 admin；后续可扩展通配符/系统权限）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'campus:notice:list',
  'campus:notice:create',
  'campus:notice:update',
  'campus:notice:delete',
  'campus:notice:publish',
  'campus:notice:pin',
  'campus:notice:manage'
)
where r.code = 'super_admin'
on conflict do nothing;

-- Auth 联动：新用户创建时自动生成 profile + 默认 user 角色
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := coalesce(new.raw_user_meta_data->>'name', '');
  v_student_id text := coalesce(new.raw_user_meta_data->>'studentId', '');
begin
  if v_name = '' then
    raise exception 'name is required';
  end if;
  if v_student_id = '' then
    raise exception 'studentId is required';
  end if;

  insert into public.profiles (id, name, student_id, status)
  values (new.id, v_name, v_student_id, 'pending_approval');

  insert into public.user_roles (user_id, role_id)
  select new.id, r.id
  from public.roles r
  where r.code = 'user'
  on conflict do nothing;

  return new;
end;
$$;

do $$ begin
  create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
exception
  when duplicate_object then null;
end $$;

-- 基线：启用 RLS（默认不开放直连；后续按模块逐步补策略）
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.user_positions enable row level security;
alter table public.notices enable row level security;
alter table public.notice_scopes enable row level security;
alter table public.notice_attachments enable row level security;
alter table public.notice_reads enable row level security;

-- profiles：允许已登录用户读取/更新自己的 profile（后续可改为仅经 BFF）
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

