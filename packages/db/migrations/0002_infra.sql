-- 基础设施扩展（用户/组织/数据权限/审计/配置）
-- 约定：以 Supabase Auth 为身份与生命周期唯一事实来源；本迁移不执行任何破坏性数据操作（仅结构演进与可逆的默认数据写入）

-- 配置表（Key-Value：jsonb）
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null
);

create index if not exists app_config_updated_at_idx on public.app_config(updated_at);

do $$ begin
  create trigger app_config_set_updated_at before update on public.app_config
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 默认：注册不需要人工审核（但支持开关）
insert into public.app_config (key, value)
values ('registration.requiresApproval', 'false'::jsonb)
on conflict (key) do nothing;

-- 读取 boolean 配置辅助函数（jsonb boolean 或 string 均可）
create or replace function public.get_config_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    (
      select case jsonb_typeof(value)
        when 'boolean' then (value #>> '{}')::boolean
        when 'string' then (value #>> '{}')::boolean
        else null
      end
      from public.app_config
      where key = p_key
      limit 1
    ),
    p_default
  );
$$;

-- profiles：默认状态调整为“待邮箱验证”（与强制邮箱验证口径一致）
alter table public.profiles
alter column status set default 'pending_email_verification';

-- profiles：移除单部门归属（改为 user_departments 多对多）
drop index if exists profiles_department_id_idx;
alter table public.profiles
drop column if exists department_id;

-- 修正历史数据：若邮箱未验证但状态仍为 pending_approval，则回退为 pending_email_verification
update public.profiles p
set status = 'pending_email_verification',
    updated_at = now()
from auth.users u
where u.id = p.id
  and u.email_confirmed_at is null
  and p.status = 'pending_approval';

-- 组织：部门闭包表（支撑“部门及子部门”的高性能范围判断）
create table if not exists public.department_closure (
  ancestor_id uuid not null references public.departments(id) on delete cascade,
  descendant_id uuid not null references public.departments(id) on delete cascade,
  depth integer not null,
  primary key (ancestor_id, descendant_id),
  constraint department_closure_depth_chk check (depth >= 0)
);

create index if not exists department_closure_ancestor_id_idx on public.department_closure(ancestor_id);
create index if not exists department_closure_descendant_id_idx on public.department_closure(descendant_id);

-- 初始化闭包表（从现有 departments 重建）
truncate table public.department_closure;

with recursive tree as (
  select d.id as ancestor_id, d.id as descendant_id, 0 as depth
  from public.departments d
  union all
  select tree.ancestor_id, c.id as descendant_id, tree.depth + 1
  from tree
  join public.departments c on c.parent_id = tree.descendant_id
)
insert into public.department_closure (ancestor_id, descendant_id, depth)
select ancestor_id, descendant_id, depth
from tree;

-- 防环：禁止将部门移动到自身子树下
create or replace function public.departments_assert_no_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception '非法 parent_id：不能指向自身';
  end if;

  if exists (
    select 1
    from public.department_closure
    where ancestor_id = new.id
      and descendant_id = new.parent_id
  ) then
    raise exception '非法移动：不能移动到自己的子部门下（会形成环）';
  end if;

  return new;
end;
$$;

do $$ begin
  create trigger departments_assert_no_cycle
  before update of parent_id on public.departments
  for each row execute function public.departments_assert_no_cycle();
exception when duplicate_object then null; end $$;

-- 闭包维护：新增部门
create or replace function public.departments_closure_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.department_closure (ancestor_id, descendant_id, depth)
  values (new.id, new.id, 0)
  on conflict do nothing;

  if new.parent_id is null then
    return new;
  end if;

  insert into public.department_closure (ancestor_id, descendant_id, depth)
  select c.ancestor_id, new.id, c.depth + 1
  from public.department_closure c
  where c.descendant_id = new.parent_id
  on conflict do nothing;

  return new;
end;
$$;

do $$ begin
  create trigger departments_closure_after_insert
  after insert on public.departments
  for each row execute function public.departments_closure_after_insert();
exception when duplicate_object then null; end $$;

-- 闭包维护：移动部门（更新 parent_id）
create or replace function public.departments_closure_after_update_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.parent_id is not distinct from new.parent_id then
    return new;
  end if;

  -- 防环（双保险）
  if new.parent_id is not null and exists (
    select 1
    from public.department_closure
    where ancestor_id = new.id
      and descendant_id = new.parent_id
  ) then
    raise exception '非法移动：不能移动到自己的子部门下（会形成环）';
  end if;

  -- 删除：旧祖先（不含自身）到子树的路径
  delete from public.department_closure dc
  using public.department_closure old_anc,
        public.department_closure sub
  where old_anc.descendant_id = new.id
    and sub.ancestor_id = new.id
    and dc.ancestor_id = old_anc.ancestor_id
    and dc.descendant_id = sub.descendant_id
    and old_anc.ancestor_id <> new.id;

  -- 根节点：无需新增路径
  if new.parent_id is null then
    return new;
  end if;

  -- 插入：新祖先到子树的路径
  insert into public.department_closure (ancestor_id, descendant_id, depth)
  select new_anc.ancestor_id, sub.descendant_id, new_anc.depth + 1 + sub.depth
  from public.department_closure new_anc
  join public.department_closure sub on sub.ancestor_id = new.id
  where new_anc.descendant_id = new.parent_id
  on conflict (ancestor_id, descendant_id) do update
  set depth = excluded.depth;

  return new;
end;
$$;

do $$ begin
  create trigger departments_closure_after_update_parent
  after update of parent_id on public.departments
  for each row execute function public.departments_closure_after_update_parent();
exception when duplicate_object then null; end $$;

-- 用户-部门（多对多）
create table if not exists public.user_departments (
  user_id uuid not null references auth.users(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, department_id)
);

create index if not exists user_departments_user_id_idx on public.user_departments(user_id);
create index if not exists user_departments_department_id_idx on public.user_departments(department_id);

-- 岗位增强：启用/停用 + 描述 + 可选 code
alter table public.positions
  add column if not exists code text null,
  add column if not exists description text null,
  add column if not exists enabled boolean not null default true;

create unique index if not exists positions_code_uq on public.positions(code);

-- 枚举：数据范围类型
do $$ begin
  create type public.data_scope_type as enum ('all', 'custom', 'dept', 'dept_and_child', 'self', 'none');
exception
  when duplicate_object then null;
end $$;

-- 角色数据范围（按 module 配置）
create table if not exists public.role_data_scopes (
  role_id uuid not null references public.roles(id) on delete cascade,
  module text not null,
  scope_type public.data_scope_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role_id, module)
);

create index if not exists role_data_scopes_role_id_idx on public.role_data_scopes(role_id);
create index if not exists role_data_scopes_module_idx on public.role_data_scopes(module);

do $$ begin
  create trigger role_data_scopes_set_updated_at before update on public.role_data_scopes
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

create table if not exists public.role_data_scope_departments (
  role_id uuid not null,
  module text not null,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, module, department_id),
  constraint role_data_scope_departments_fk
    foreign key (role_id, module) references public.role_data_scopes(role_id, module) on delete cascade
);

create index if not exists role_data_scope_departments_role_id_idx on public.role_data_scope_departments(role_id);
create index if not exists role_data_scope_departments_module_idx on public.role_data_scope_departments(module);
create index if not exists role_data_scope_departments_department_id_idx on public.role_data_scope_departments(department_id);

-- 审计日志（append-only；MVP 先落表，策略/约束在实现阶段强化）
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid not null,
  actor_email text null,
  actor_roles jsonb null,
  action text not null,
  target_type text not null,
  target_id text not null,
  success boolean not null default true,
  error_code text null,
  reason text null,
  diff jsonb null,
  request_id text null,
  ip text null,
  user_agent text null
);

create index if not exists audit_logs_occurred_at_idx on public.audit_logs(occurred_at);
create index if not exists audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);
create index if not exists audit_logs_action_idx on public.audit_logs(action);
create index if not exists audit_logs_target_idx on public.audit_logs(target_type, target_id);

-- 审计日志：append-only（禁止 UPDATE/DELETE）
create or replace function public.audit_logs_block_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'audit_logs 为只追加表，禁止更新或删除';
  return null;
end;
$$;

do $$ begin
  create trigger audit_logs_block_update
  before update on public.audit_logs
  for each row execute function public.audit_logs_block_mutation();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger audit_logs_block_delete
  before delete on public.audit_logs
  for each row execute function public.audit_logs_block_mutation();
exception when duplicate_object then null; end $$;

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
  v_requires_approval boolean := public.get_config_bool('registration.requiresApproval', false);
  v_status public.profile_status;
begin
  if v_name = '' then
    raise exception 'name is required';
  end if;
  if v_student_id = '' then
    raise exception 'studentId is required';
  end if;

  if new.email_confirmed_at is null then
    v_status := 'pending_email_verification';
  else
    v_status := case when v_requires_approval then 'pending_approval' else 'active' end;
  end if;

  insert into public.profiles (id, name, student_id, status)
  values (new.id, v_name, v_student_id, v_status)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role_id)
  select new.id, r.id
  from public.roles r
  where r.code = 'user'
  on conflict do nothing;

  return new;
end;
$$;

-- Auth 联动：邮箱验证通过后更新 profile 状态
create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requires_approval boolean := public.get_config_bool('registration.requiresApproval', false);
  v_next_status public.profile_status := case when v_requires_approval then 'pending_approval' else 'active' end;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
    set status = v_next_status,
        updated_at = now()
    where id = new.id
      and status = 'pending_email_verification';
  end if;

  return new;
end;
$$;

do $$ begin
  create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_email_confirmed();
exception
  when duplicate_object then null;
end $$;

-- 权限种子（基础设施）
insert into public.permissions (code, description)
values
  ('campus:user:list', '用户列表/查询'),
  ('campus:user:read', '用户详情查看'),
  ('campus:user:create', '创建用户（含导入）'),
  ('campus:user:update', '编辑用户基础信息'),
  ('campus:user:approve', '审核用户注册'),
  ('campus:user:disable', '停用/启用用户'),
  ('campus:user:ban', '封禁/解封用户（Supabase Auth）'),
  ('campus:user:delete', '删除用户（Supabase Auth）'),
  ('campus:user:invite', '邀请用户注册（Supabase Auth）'),
  ('campus:user:import', '批量导入用户'),
  ('campus:user:assign_role', '为用户分配角色'),
  ('campus:user:assign_org', '为用户分配部门/岗位'),
  ('campus:role:*', '角色管理（全量）'),
  ('campus:permission:*', '权限管理（全量）'),
  ('campus:department:*', '部门管理（全量）'),
  ('campus:position:*', '岗位管理（全量）'),
  ('campus:audit:list', '审计日志查询'),
  ('campus:config:update', '平台配置修改')
on conflict (code) do nothing;

-- 角色-权限：admin / super_admin（基础设施全量管理）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'campus:user:list',
  'campus:user:read',
  'campus:user:create',
  'campus:user:update',
  'campus:user:approve',
  'campus:user:disable',
  'campus:user:ban',
  'campus:user:delete',
  'campus:user:invite',
  'campus:user:import',
  'campus:user:assign_role',
  'campus:user:assign_org',
  'campus:role:*',
  'campus:permission:*',
  'campus:department:*',
  'campus:position:*',
  'campus:audit:list',
  'campus:config:update'
)
where r.code in ('admin', 'super_admin')
on conflict do nothing;

-- RLS：新增表启用（默认不开放直连；策略在实现阶段补齐）
alter table public.app_config enable row level security;
alter table public.department_closure enable row level security;
alter table public.user_departments enable row level security;
alter table public.role_data_scopes enable row level security;
alter table public.role_data_scope_departments enable row level security;
alter table public.audit_logs enable row level security;
