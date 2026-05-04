-- ============================================================
-- 1. 扩展与枚举
-- ============================================================

-- pgcrypto 提供 gen_random_uuid()，后面很多主键都用它自动生成 uuid。
create extension if not exists "pgcrypto";
-- btree_gist 支持把 uuid 的“相等比较”和时间范围的“重叠比较”放进同一个 GiST 排斥约束。
-- 功能房预约的“同一房间时间段不能重叠”依赖它。
create extension if not exists btree_gist with schema public;

-- 用户状态枚举：用 enum 固定合法取值，防止状态字段被写成随意文本。
do $$ begin
  create type public.profile_status as enum (
    'active',
    'disabled',
    'banned',
    'pending_approval',
    'pending_email_verification'
  );
exception when duplicate_object then null; end $$;

-- 数据范围枚举：用于表达某个角色在某个模块能看哪些数据。
-- all=全部，custom=自定义部门，dept=本部门，dept_and_child=本部门及子部门，self=本人，none=无权限。
do $$ begin
  create type public.data_scope_type as enum (
    'all',
    'custom',
    'dept',
    'dept_and_child',
    'self',
    'none'
  );
exception when duplicate_object then null; end $$;

-- 功能房预约状态：
-- pending 待审核，approved 已通过，rejected 已驳回，cancelled 已取消。
do $$ begin
  create type public.facility_reservation_status as enum (
    'pending',
    'approved',
    'rejected',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

-- 课程资源类型：file 表示上传文件，link 表示外部链接。
do $$ begin
  create type public.course_resource_type as enum ('file', 'link');
exception when duplicate_object then null; end $$;

-- 课程资源状态机：
-- draft 草稿，pending 待审核，published 已发布，rejected 已驳回，unpublished 已下架。
do $$ begin
  create type public.course_resource_status as enum (
    'draft',
    'pending',
    'published',
    'rejected',
    'unpublished'
  );
exception when duplicate_object then null; end $$;

-- 积分事件类型：approve=审核通过加分，best=设为最佳加分。
do $$ begin
  create type public.course_resource_score_event_type as enum ('approve', 'best');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 2. 通用函数
-- ============================================================

-- 所有带 updated_at 的表都复用这个触发器函数，避免上层忘记维护更新时间。
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- new 是触发器里的“即将写回数据库的新行”。
  -- 这里直接把更新时间改成当前时间，再返回 new。
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 3. 平台基础：配置、组织、用户、角色、权限
-- ============================================================

-- 平台配置表。
-- key 是配置名，value 用 jsonb 保存配置值，例如是否需要注册审核、预约最长时长、积分分值。
-- 把可变业务参数放在配置表里，避免写死在代码中。
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- updated_by 记录最后修改配置的人；用户被删除时置空，不删除配置本身。
  updated_by uuid null references auth.users(id) on delete set null
);

create index if not exists app_config_updated_at_idx on public.app_config(updated_at);

do $$ begin
  create trigger app_config_set_updated_at
  before update on public.app_config
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 平台配置读取函数：支持 jsonb boolean 和 jsonb string 两种写法。
-- stable 表示在一条 SQL 语句内结果稳定；函数只读取配置，不修改数据。
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

-- 部门是树结构，parent_id 自引用 departments.id。
-- parent_id 表达“直接上级”，department_closure 表达“祖先-后代可达关系”。
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- parent_id 为空表示根部门。
  parent_id uuid null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 自引用外键：父部门必须真实存在；on delete restrict 防止删除仍有子部门的父部门。
  constraint departments_parent_id_fk
    foreign key (parent_id) references public.departments(id) on delete restrict
);

create index if not exists departments_parent_id_idx on public.departments(parent_id);

do $$ begin
  create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 闭包表保存所有“祖先部门 -> 后代部门”的关系，用于快速判断“部门及子部门”。
-- 例：A 学院下有 B 系，B 系下有 C 班，则闭包表里有 A->A、A->B、A->C、B->B、B->C、C->C。
create table if not exists public.department_closure (
  ancestor_id uuid not null references public.departments(id) on delete cascade,
  descendant_id uuid not null references public.departments(id) on delete cascade,
  -- depth=0 表示自己到自己；depth=1 表示父子；depth 越大层级越深。
  depth integer not null,
  -- 一个祖先到一个后代只需要一条记录。
  primary key (ancestor_id, descendant_id),
  constraint department_closure_depth_chk check (depth >= 0)
);

create index if not exists department_closure_ancestor_id_idx on public.department_closure(ancestor_id);
create index if not exists department_closure_descendant_id_idx on public.department_closure(descendant_id);

-- 岗位表：岗位表示职务身份，和部门归属不是同一个概念。
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  -- code 是可选稳定编号，name 是展示名称。
  code text null,
  name text not null,
  description text null,
  enabled boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists positions_name_uq on public.positions(name);
create unique index if not exists positions_code_uq on public.positions(code);

do $$ begin
  create trigger positions_set_updated_at
  before update on public.positions
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 角色表：角色是权限集合，例如 user、admin、super_admin。
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  -- code 是程序和数据库共同识别角色的稳定编号，必须唯一。
  code text not null,
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists roles_code_uq on public.roles(code);

do $$ begin
  create trigger roles_set_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 权限码表：权限码是最小授权单元，例如 campus:facility:review。
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text null,
  created_at timestamptz not null default now()
);

create unique index if not exists permissions_code_uq on public.permissions(code);

-- profiles 是 auth.users 的一对一业务扩展表。
-- auth.users 负责登录认证；profiles 保存业务侧需要展示/管理的用户资料。
create table if not exists public.profiles (
  -- id 同时是主键和外键，表示一个认证用户最多一条业务资料。
  id uuid primary key references auth.users(id) on delete cascade,
  -- email 等字段是认证快照，方便管理端查询；真正认证源头仍是 auth.users。
  email text null,
  email_confirmed_at timestamptz null,
  name text not null,
  username text null,
  -- student_id 是业务候选键：必须唯一，且格式必须是 16 位数字。
  student_id text not null,
  avatar_url text null,
  status public.profile_status not null default 'pending_email_verification',
  auth_banned_until timestamptz null,
  auth_deleted_at timestamptz null,
  last_login_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 用户定义完整性：数据库层直接拒绝非法学号格式。
  constraint profiles_student_id_format_chk check (student_id ~ '^[0-9]{16}$')
);

create index if not exists profiles_email_idx on public.profiles(email);
-- PostgreSQL 唯一索引允许多个 null，所以 username 可以为空；非空时不能重复。
create unique index if not exists profiles_username_uq on public.profiles(username);
create unique index if not exists profiles_student_id_uq on public.profiles(student_id);
create index if not exists profiles_status_idx on public.profiles(status);
create index if not exists profiles_auth_banned_until_idx on public.profiles(auth_banned_until);
create index if not exists profiles_auth_deleted_at_idx on public.profiles(auth_deleted_at);

do $$ begin
  create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 用户-岗位：多对多联系表。
-- 一名用户可以有多个岗位，一个岗位也可以分配给多个用户。
create table if not exists public.user_positions (
  user_id uuid not null references auth.users(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 复合主键防止同一用户重复分配同一岗位。
  primary key (user_id, position_id)
);

create index if not exists user_positions_user_id_idx on public.user_positions(user_id);

-- 用户-部门：多对多联系表。
-- 不把 department_id 放进 profiles，是为了支持一个用户属于多个部门。
create table if not exists public.user_departments (
  user_id uuid not null references auth.users(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  created_at timestamptz not null default now(),
  -- 复合主键防止重复加入同一部门。
  primary key (user_id, department_id)
);

create index if not exists user_departments_user_id_idx on public.user_departments(user_id);
create index if not exists user_departments_department_id_idx on public.user_departments(department_id);

-- 用户-角色：多对多联系表。
-- 这是 RBAC 的第一层：用户通过角色间接获得权限。
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 复合主键防止同一用户重复拥有同一角色。
  primary key (user_id, role_id)
);

create index if not exists user_roles_user_id_idx on public.user_roles(user_id);

-- 角色-权限：多对多联系表。
-- 这是 RBAC 的第二层：角色绑定多个权限码。
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 复合主键防止同一角色重复绑定同一权限。
  primary key (role_id, permission_id)
);

create index if not exists role_permissions_role_id_idx on public.role_permissions(role_id);

-- ============================================================
-- 4. 平台基础：模块字典、数据范围、审计日志
-- ============================================================

-- 模块字典表：系统认可的模块统一登记在这里。
-- 把 module 从自由文本收敛成字典表，增强参照完整性。
create table if not exists public.app_modules (
  -- code 是模块主键，例如 facility、resource、user。
  code text primary key,
  name text not null,
  enabled boolean not null default true,
  sort integer not null default 0,
  remark text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 模块 code 必须小写字母开头，只允许小写字母、数字、下划线。
  constraint app_modules_code_format_chk check (code ~ '^[a-z][a-z0-9_]*$')
);

-- 模块中文名也唯一，避免两个 code 显示成同一个模块。
create unique index if not exists app_modules_name_uq on public.app_modules(name);
create index if not exists app_modules_enabled_idx on public.app_modules(enabled);
create index if not exists app_modules_sort_idx on public.app_modules(sort);

do $$ begin
  create trigger app_modules_set_updated_at
  before update on public.app_modules
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 数据范围模块表：不是所有模块都需要“本部门/本部门及子部门/本人”等数据范围。
-- 这张表只列出支持数据权限的模块，是 app_modules 的子集。
create table if not exists public.data_scope_modules (
  module_code text primary key,
  created_at timestamptz not null default now(),
  -- 只有 app_modules 中存在的模块，才能声明为数据范围模块。
  constraint data_scope_modules_module_code_fk
    foreign key (module_code) references public.app_modules(code) on delete restrict
);

-- 角色数据范围主表：表达“某个角色在某个模块能看哪些数据”。
create table if not exists public.role_data_scopes (
  role_id uuid not null references public.roles(id) on delete cascade,
  -- module 不再是自由文本，必须引用 data_scope_modules.module_code。
  module text not null,
  scope_type public.data_scope_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 一个角色在一个模块只能有一条范围规则，避免规则冲突。
  primary key (role_id, module),
  constraint role_data_scopes_module_fk
    foreign key (module) references public.data_scope_modules(module_code) on delete restrict
);

create index if not exists role_data_scopes_role_id_idx on public.role_data_scopes(role_id);
create index if not exists role_data_scopes_module_idx on public.role_data_scopes(module);

do $$ begin
  create trigger role_data_scopes_set_updated_at
  before update on public.role_data_scopes
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 自定义数据范围明细表。
-- 当 role_data_scopes.scope_type='custom' 时，这里列出允许访问的部门。
create table if not exists public.role_data_scope_departments (
  role_id uuid not null,
  module text not null,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 同一角色、同一模块、同一部门不能重复配置。
  primary key (role_id, module, department_id),
  -- 复合外键保证：部门明细不能脱离 role_data_scopes 主配置单独存在。
  constraint role_data_scope_departments_fk
    foreign key (role_id, module) references public.role_data_scopes(role_id, module) on delete cascade
);

create index if not exists role_data_scope_departments_role_id_idx on public.role_data_scope_departments(role_id);
create index if not exists role_data_scope_departments_module_idx on public.role_data_scope_departments(module);
create index if not exists role_data_scope_departments_department_id_idx on public.role_data_scope_departments(department_id);

-- 审计日志采用 append-only + 操作者快照，不对 actor_user_id 建物理外键。
-- 审计记录是历史事实，用户以后删除/脱敏，不应该破坏过去发生过的操作记录。
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- 事件发生时间，不等同于目标对象的 updated_at。
  occurred_at timestamptz not null default now(),
  -- 弱引用：保留操作者 id，但不建 auth.users 外键。
  actor_user_id uuid not null,
  -- 操作者快照：保留事件发生时的邮箱、姓名、角色语义。
  actor_email text null,
  actor_name text null,
  actor_roles jsonb null,
  -- action + target_type + target_id 描述“谁对什么对象做了什么动作”。
  action text not null,
  target_type text not null,
  target_id text not null,
  success boolean not null default true,
  error_code text null,
  reason text null,
  diff jsonb null,
  request_id text null,
  ip text null,
  user_agent text null,
  -- actor_roles 如果记录了 roleCodes，则必须是数组，避免 JSON 结构乱写。
  constraint audit_logs_actor_roles_object_chk check (
    actor_roles is null
    or case
      when jsonb_typeof(actor_roles) <> 'object' then false
      when not (actor_roles ? 'roleCodes') then true
      else jsonb_typeof(actor_roles -> 'roleCodes') = 'array'
    end
  )
);

create index if not exists audit_logs_occurred_at_idx on public.audit_logs(occurred_at);
create index if not exists audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);
create index if not exists audit_logs_action_idx on public.audit_logs(action);
create index if not exists audit_logs_target_idx on public.audit_logs(target_type, target_id);

create or replace function public.audit_logs_block_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- UPDATE/DELETE 进入这里就直接抛异常。
  -- 这样即使有人绕过服务层直接操作数据库，也不能事后篡改审计日志。
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

comment on table public.audit_logs is
  '管理端审计日志；append-only。actor_user_id 为审计主体标识，故意不建立到 auth.users 的物理外键，避免用户删除或脱敏后破坏历史审计事实。';

comment on column public.audit_logs.actor_user_id is
  '审计主体标识（弱引用）。为保留历史事实，不建立到 auth.users 的物理外键。';

comment on column public.audit_logs.actor_name is
  '操作者姓名快照，保留事件发生时的可读身份语义。';

comment on column public.audit_logs.actor_email is
  '操作者邮箱快照，便于检索；不依赖当前 auth.users 中的最新值。';

comment on column public.audit_logs.actor_roles is
  '操作者角色快照，建议结构为 {"roleCodes": [...]}，用于保留事件发生时的权限语义。';

comment on column public.audit_logs.diff is
  '变更差异快照；建议仅记录白名单字段，避免审计扩散敏感信息。';

-- ============================================================
-- 5. 平台基础：部门树维护与 Auth 联动
-- ============================================================

create or replace function public.departments_assert_no_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- parent_id 为空表示根部门，不可能形成环。
  if new.parent_id is null then
    return new;
  end if;

  -- 最直接的非法情况：父部门就是自己。
  if new.parent_id = new.id then
    raise exception '非法 parent_id：不能指向自身';
  end if;

  -- 如果 new.parent_id 已经是 new.id 的后代，再把 new.id 挂过去就会形成环。
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

create or replace function public.departments_closure_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 每个部门都是自己的祖先，depth=0。
  insert into public.department_closure (ancestor_id, descendant_id, depth)
  values (new.id, new.id, 0)
  on conflict do nothing;

  -- 根部门只需要自己到自己这一条闭包记录。
  if new.parent_id is null then
    return new;
  end if;

  -- 新部门挂到父部门下时，父部门的所有祖先也都成为新部门的祖先。
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

create or replace function public.departments_closure_after_update_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- is not distinct from 可以正确比较 null；两个 null 也认为“没有变化”。
  if old.parent_id is not distinct from new.parent_id then
    return new;
  end if;

  if new.parent_id is not null and exists (
    select 1
    from public.department_closure
    where ancestor_id = new.id
      and descendant_id = new.parent_id
  ) then
    raise exception '非法移动：不能移动到自己的子部门下（会形成环）';
  end if;

  -- 删除旧祖先到当前子树的路径。
  delete from public.department_closure dc
  using public.department_closure old_anc,
        public.department_closure sub
  where old_anc.descendant_id = new.id
    and sub.ancestor_id = new.id
    and dc.ancestor_id = old_anc.ancestor_id
    and dc.descendant_id = sub.descendant_id
    and old_anc.ancestor_id <> new.id;

  if new.parent_id is null then
    return new;
  end if;

  -- 补上新祖先到当前子树的路径。
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- raw_user_meta_data 是注册时传入的用户元数据。
  v_name text := coalesce(new.raw_user_meta_data->>'name', '');
  v_student_id text := coalesce(new.raw_user_meta_data->>'studentId', '');
  v_requires_approval boolean := public.get_config_bool('registration.requiresApproval', false);
  v_status public.profile_status;
begin
  -- 数据库层兜底校验：没有姓名或学号就拒绝创建业务资料。
  if v_name = '' then
    raise exception 'name is required';
  end if;

  if v_student_id = '' then
    raise exception 'studentId is required';
  end if;

  -- 初始状态由邮箱验证状态和注册审核配置共同决定。
  if new.email_confirmed_at is null then
    v_status := 'pending_email_verification';
  else
    v_status := case when v_requires_approval then 'pending_approval' else 'active' end;
  end if;

  -- 创建 profiles 业务资料，并同步 auth.users 中的认证快照字段。
  insert into public.profiles (
    id,
    email,
    email_confirmed_at,
    name,
    student_id,
    status,
    last_login_at,
    auth_banned_until,
    auth_deleted_at
  )
  values (
    new.id,
    new.email,
    new.email_confirmed_at,
    v_name,
    v_student_id,
    v_status,
    new.last_sign_in_at,
    new.banned_until,
    new.deleted_at
  )
  on conflict (id) do nothing;

  -- 新用户自动拥有普通用户角色。
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
exception when duplicate_object then null; end $$;

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
  -- 只处理“刚完成邮箱验证”的那次变化。
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
exception when duplicate_object then null; end $$;

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.users 是认证源头；profiles 保存一份查询友好的认证快照。
  update public.profiles
  set
    email = new.email,
    email_confirmed_at = new.email_confirmed_at,
    auth_banned_until = new.banned_until,
    auth_deleted_at = new.deleted_at,
    last_login_at = coalesce(new.last_sign_in_at, public.profiles.last_login_at)
  where public.profiles.id = new.id;

  return new;
end;
$$;

do $$ begin
  create trigger on_auth_user_profile_sync
  after update of email, email_confirmed_at, banned_until, deleted_at, last_sign_in_at on auth.users
  for each row execute function public.sync_profile_from_auth_user();
exception when duplicate_object then null; end $$;

-- ============================================================
-- 6. 功能房预约
-- ============================================================

-- 楼房表：功能房的上层空间实体，例如教学楼、实验楼。
create table if not exists public.facility_buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enabled boolean not null default true,
  sort integer not null default 0,
  remark text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

-- 有效楼房名称唯一；已软删除记录不参与唯一性判断。
create unique index if not exists facility_buildings_name_active_uq
  on public.facility_buildings(name)
  where deleted_at is null;
create index if not exists facility_buildings_enabled_idx on public.facility_buildings(enabled);
create index if not exists facility_buildings_sort_idx on public.facility_buildings(sort);

do $$ begin
  create trigger facility_buildings_set_updated_at
  before update on public.facility_buildings
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 房间表：具体可预约资源。
-- 关系：一个楼房有多个房间，房间必须属于真实楼房。
create table if not exists public.facility_rooms (
  id uuid primary key default gen_random_uuid(),
  -- on delete restrict：楼房下还有房间时，不允许物理删除楼房。
  building_id uuid not null references public.facility_buildings(id) on delete restrict,
  floor_no integer not null,
  name text not null,
  -- capacity 可为空；如果填写，就不能为负数。
  capacity integer null,
  enabled boolean not null default true,
  sort integer not null default 0,
  remark text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint facility_rooms_capacity_chk check (capacity is null or capacity >= 0)
);

-- 房间名不是全校唯一，而是“同一楼房 + 同一楼层 + 同一房间名”唯一。
-- 例：A 楼 101 和 B 楼 101 可以同时存在。
create unique index if not exists facility_rooms_name_active_uq
  on public.facility_rooms(building_id, floor_no, name)
  where deleted_at is null;
create index if not exists facility_rooms_building_id_idx on public.facility_rooms(building_id);
create index if not exists facility_rooms_building_floor_idx on public.facility_rooms(building_id, floor_no);
create index if not exists facility_rooms_enabled_idx on public.facility_rooms(enabled);
create index if not exists facility_rooms_sort_idx on public.facility_rooms(sort);

do $$ begin
  create trigger facility_rooms_set_updated_at
  before update on public.facility_rooms
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 预约表：功能房模块最核心的事务表。
-- 一条记录表示某个申请人，在某个时间段，为某个用途占用某个房间。
-- 预约只存 room_id，不重复存楼房名/房间名，避免更新异常，符合 3NF 思路。
create table if not exists public.facility_reservations (
  id uuid primary key default gen_random_uuid(),
  -- 预约必须指向真实房间；有预约历史的房间不允许随便物理删除。
  room_id uuid not null references public.facility_rooms(id) on delete restrict,
  -- applicant_id 是业务上的申请人，必须是真实用户。
  applicant_id uuid not null references auth.users(id) on delete restrict,
  purpose text not null,
  -- 使用 timestamptz 保存带时区时间，避免跨时区比较歧义。
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.facility_reservation_status not null,

  -- 审核痕迹：谁审核、什么时候审核。
  -- 审核人以后被删除时，只把 reviewed_by 置空，不删除预约历史。
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  -- reject_reason 只应出现在 rejected 状态。
  reject_reason text null,

  -- 取消痕迹：谁取消、什么时候取消、为什么取消。
  cancelled_by uuid null references auth.users(id) on delete set null,
  cancelled_at timestamptz null,
  cancel_reason text null,

  -- created_by 表示“这条记录由谁创建”，和 applicant_id 语义不同。
  -- 普通用户自助申请时二者通常相同；管理员代申请时可能不同。
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid null references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 基础时间合法性：结束时间必须晚于开始时间。
  constraint facility_reservations_time_chk check (end_at > start_at),
  -- 状态一致性约束：
  -- pending：不能有审核/驳回/取消字段；
  -- approved：必须有审核人和审核时间；
  -- rejected：必须有审核人、审核时间、驳回原因；
  -- cancelled：必须有取消人和取消时间，且不能有驳回原因。
  constraint facility_reservations_status_consistency_chk check (
    (
      status = 'pending'
      and reviewed_by is null
      and reviewed_at is null
      and reject_reason is null
      and cancelled_by is null
      and cancelled_at is null
      and cancel_reason is null
    )
    or
    (
      status = 'approved'
      and reviewed_by is not null
      and reviewed_at is not null
      and reject_reason is null
      and cancelled_by is null
      and cancelled_at is null
      and cancel_reason is null
    )
    or
    (
      status = 'rejected'
      and reviewed_by is not null
      and reviewed_at is not null
      and reject_reason is not null
      and cancelled_by is null
      and cancelled_at is null
      and cancel_reason is null
    )
    or
    (
      status = 'cancelled'
      and cancelled_by is not null
      and cancelled_at is not null
      and reject_reason is null
      and (
        (reviewed_by is null and reviewed_at is null)
        or
        (reviewed_by is not null and reviewed_at is not null)
      )
    )
  ),
  -- 时间冲突排斥约束：
  -- 同一个 room_id 下，pending/approved 预约的 [start_at,end_at) 时间区间不能重叠。
  -- '[)' 表示包含开始、不包含结束，所以 10:00-11:00 和 11:00-12:00 不冲突。
  constraint facility_reservations_room_active_time_excl
    exclude using gist (
      room_id with =,
      tstzrange(start_at, end_at, '[)') with &&
    )
    where (status in ('pending', 'approved'))
);

create index if not exists facility_reservations_room_id_idx on public.facility_reservations(room_id);
create index if not exists facility_reservations_applicant_id_idx on public.facility_reservations(applicant_id);
create index if not exists facility_reservations_status_idx on public.facility_reservations(status);
create index if not exists facility_reservations_time_room_idx on public.facility_reservations(room_id, start_at, end_at);
create index if not exists facility_reservations_room_active_time_idx
  on public.facility_reservations(room_id, start_at, end_at)
  where status in ('pending', 'approved');

do $$ begin
  create trigger facility_reservations_set_updated_at
  before update on public.facility_reservations
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 预约参与人表：预约和用户是多对多关系。
-- 不把参与人写成逗号字符串，是为了满足 1NF，并能用外键约束每个参与人是真实用户。
create table if not exists public.facility_reservation_participants (
  -- 预约删除后，参与人明细跟着删除。
  reservation_id uuid not null references public.facility_reservations(id) on delete cascade,
  -- 用户删除时不允许破坏历史参与关系。
  user_id uuid not null references auth.users(id) on delete restrict,
  -- 标记这条参与人记录是否是申请人本人。
  is_applicant boolean not null default false,
  created_at timestamptz not null default now(),
  -- 同一预约中，同一用户只能出现一次。
  primary key (reservation_id, user_id)
);

create index if not exists facility_reservation_participants_user_id_idx
  on public.facility_reservation_participants(user_id);
-- 每条预约最多一个 is_applicant=true。
-- “至少一个申请人”和“申请人必须等于 applicant_id”由下面的延迟触发器继续保证。
create unique index if not exists facility_reservation_participants_applicant_uq
  on public.facility_reservation_participants(reservation_id)
  where is_applicant;

-- 封禁表：记录功能房模块的治理动作。
-- 一个用户可以有多条历史封禁，但同一时间最多一条未撤销封禁。
create table if not exists public.facility_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  reason text null,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  revoked_reason text null,
  created_by uuid not null references auth.users(id) on delete restrict,
  revoked_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- 如果撤销了封禁，撤销时间不能早于创建时间。
  constraint facility_bans_revoked_chk check (revoked_at is null or revoked_at >= created_at)
);

create index if not exists facility_bans_user_id_idx on public.facility_bans(user_id);
create index if not exists facility_bans_revoked_at_idx on public.facility_bans(revoked_at);
create index if not exists facility_bans_expires_at_idx on public.facility_bans(expires_at);
-- 部分唯一索引：同一用户只能有一条 revoked_at is null 的封禁记录。
-- 自然过期但未显式撤销的封禁，仍然会占用这个唯一位置。
create unique index if not exists facility_bans_user_active_uq
  on public.facility_bans(user_id)
  where revoked_at is null;

create or replace function public.facility_validate_reservation_participants()
returns trigger
language plpgsql
as $$
declare
  -- 当前要校验的预约 id。
  v_reservation_id uuid;
  -- 预约主表里的申请人 id。
  v_applicant_id uuid;
  -- 当前预约的参与人总数。
  v_participant_count integer;
  -- is_applicant=true 的参与人数量。
  v_applicant_marked_count integer;
  -- is_applicant=true 且 user_id 等于主表 applicant_id 的数量。
  v_applicant_match_count integer;
begin
  -- 这个函数会被两张表触发：
  -- 1. facility_reservation_participants 变化时；
  -- 2. facility_reservations.applicant_id 变化时。
  -- 所以先根据触发表名取出 reservation_id。
  if tg_table_name = 'facility_reservation_participants' then
    -- INSERT 有 new，DELETE 有 old，UPDATE 两者都有。
    v_reservation_id := case
      when tg_op = 'DELETE' then old.reservation_id
      when tg_op = 'INSERT' then new.reservation_id
      else coalesce(new.reservation_id, old.reservation_id)
    end;
  else
    v_reservation_id := case
      when tg_op = 'DELETE' then old.id
      when tg_op = 'INSERT' then new.id
      else coalesce(new.id, old.id)
    end;
  end if;

  if v_reservation_id is null then
    return null;
  end if;

  select r.applicant_id
    into v_applicant_id
  from public.facility_reservations r
  where r.id = v_reservation_id;

  if v_applicant_id is null then
    return null;
  end if;

  -- 统计参与人总数、申请人标记数量、申请人是否与主表 applicant_id 匹配。
  -- 这是跨多行的规则，普通 CHECK 无法完成。
  select
    count(*)::integer,
    (count(*) filter (where p.is_applicant))::integer,
    (count(*) filter (where p.is_applicant and p.user_id = v_applicant_id))::integer
    into v_participant_count, v_applicant_marked_count, v_applicant_match_count
  from public.facility_reservation_participants p
  where p.reservation_id = v_reservation_id;

  -- 规则 1：每条预约至少 3 个参与人。
  if v_participant_count < 3 then
    raise exception using
      errcode = '23514',
      message = 'facility reservation participants must be at least 3',
      constraint = 'facility_reservation_participants_min_count_chk';
  end if;

  -- 规则 2：必须且只能有一个参与人被标记为申请人。
  if v_applicant_marked_count <> 1 then
    raise exception using
      errcode = '23514',
      message = 'facility reservation must have exactly one applicant participant',
      constraint = 'facility_reservation_participants_applicant_count_chk';
  end if;

  -- 规则 3：被标记为申请人的 user_id 必须等于预约主表 applicant_id。
  if v_applicant_match_count <> 1 then
    raise exception using
      errcode = '23514',
      message = 'facility reservation applicant must match applicant_id',
      constraint = 'facility_reservation_participants_applicant_match_chk';
  end if;

  return null;
end;
$$;

do $$ begin
  -- 约束触发器延迟到事务提交时执行。
  -- 原因：创建预约时通常先插主表，再插参与人，事务中间态可能暂时不足 3 人。
  create constraint trigger facility_reservations_participant_consistency_trg
  after insert or update of applicant_id on public.facility_reservations
  deferrable initially deferred
  for each row execute function public.facility_validate_reservation_participants();
exception when duplicate_object then null; end $$;

do $$ begin
  -- 参与人增删改后，也在事务提交时检查最终集合是否合法。
  create constraint trigger facility_reservation_participants_consistency_trg
  after insert or update or delete on public.facility_reservation_participants
  deferrable initially deferred
  for each row execute function public.facility_validate_reservation_participants();
exception when duplicate_object then null; end $$;

-- ============================================================
-- 7. 课程资源分享
-- ============================================================

-- 专业表：课程资源的上层教学主数据。
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

-- 有效专业名称唯一；已软删除历史不参与唯一性判断。
create unique index if not exists majors_name_active_uq
  on public.majors(name)
  where deleted_at is null;
create index if not exists majors_enabled_idx on public.majors(enabled);

do $$ begin
  create trigger majors_set_updated_at
  before update on public.majors
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 专业负责人表：专业和用户是多对多关系。
-- 一个专业可以多个负责人，一个用户也可以负责多个专业。
create table if not exists public.major_leads (
  major_id uuid not null references public.majors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 同一用户不能重复成为同一专业负责人。
  primary key (major_id, user_id)
);

create index if not exists major_leads_user_id_idx on public.major_leads(user_id);

-- 课程表：课程必须属于某个专业。
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  -- 专业下仍有课程时，不允许物理删除专业。
  major_id uuid not null references public.majors(id) on delete restrict,
  name text not null,
  code text null,
  enabled boolean not null default true,
  sort integer not null default 0,
  remark text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  -- 为 course_resources(course_id, major_id) 复合外键准备被引用唯一键。
  constraint courses_id_major_id_uq unique (id, major_id)
);

-- 课程名不是全局唯一，而是“同一专业下课程名唯一”。
create unique index if not exists courses_major_name_active_uq
  on public.courses(major_id, name)
  where deleted_at is null;
create index if not exists courses_major_id_idx on public.courses(major_id);
create index if not exists courses_enabled_idx on public.courses(enabled);

do $$ begin
  create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 课程资源主体表。
-- 一条资源属于某门课程，同时保存 major_id 作为受控冗余，便于按专业过滤、统计和授权。
-- major_id 不是随便冗余，下面用复合外键保证它必须等于课程真实所属专业。
create table if not exists public.course_resources (
  id uuid primary key default gen_random_uuid(),
  major_id uuid not null references public.majors(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  title text not null,
  description text not null,
  resource_type public.course_resource_type not null,
  status public.course_resource_status not null default 'draft',

  -- 文件型资源字段：对象存储位置、文件名、大小、内容摘要。
  file_bucket text null,
  file_key text null,
  file_name text null,
  file_size integer null,
  sha256 text null,

  -- 外链型资源字段：原始 URL 和规范化 URL。
  -- 规范化 URL 用于去重，例如去掉无意义的尾斜杠、统一大小写等。
  link_url text null,
  link_url_normalized text null,

  -- 提交审核时间。draft 状态下必须为空。
  submitted_at timestamptz null,

  -- 审核痕迹：谁审核、什么时候审核、审核意见。
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  review_comment text null,

  -- 发布/下架时间，用来解释 published/unpublished 状态。
  published_at timestamptz null,
  unpublished_at timestamptz null,

  -- download_count 是汇总冗余，用于快速排序；真实下载明细在 course_resource_download_events。
  download_count integer not null default 0,
  last_download_at timestamptz null,

  -- created_by 是资源作者，积分事件必须归属给这个作者。
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid null references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  -- 数值类用户定义完整性。
  constraint course_resources_download_count_chk check (download_count >= 0),
  constraint course_resources_file_size_chk check (file_size is null or file_size >= 0),
  -- 为积分事件的“资源-专业一致性”和“资源-作者一致性”复合外键准备唯一键。
  constraint course_resources_id_major_id_uq unique (id, major_id),
  constraint course_resources_id_created_by_uq unique (id, created_by),
  -- 复合外键：资源的 course_id 和 major_id 必须能在 courses(id, major_id) 中同时找到。
  -- 如果某课程属于 A 专业，却把资源 major_id 写成 B 专业，数据库会拒绝。
  constraint course_resources_course_major_fk
    foreign key (course_id, major_id)
    references public.courses(id, major_id)
    on update cascade
    on delete restrict,
  -- 文件/外链字段组合约束：
  -- file 类型不能混入 link 字段；link 类型不能混入 file 字段；
  -- draft 草稿允许暂缺文件/链接明细，非草稿必须补全对应明细。
  constraint course_resources_file_or_link_chk check (
    (
      resource_type = 'file'
      and link_url is null
      and link_url_normalized is null
      and (
        (
          status = 'draft'
          and file_bucket is null
          and file_key is null
          and file_name is null
          and file_size is null
          and sha256 is null
        )
        or
        (
          file_bucket is not null
          and file_key is not null
          and file_name is not null
          and file_size is not null
          and sha256 is not null
        )
      )
    )
    or
    (
      resource_type = 'link'
      and file_bucket is null
      and file_key is null
      and file_name is null
      and file_size is null
      and sha256 is null
      and (
        (
          status = 'draft'
          and link_url is null
          and link_url_normalized is null
        )
        or
        (
          link_url is not null
          and link_url_normalized is not null
        )
      )
    )
  ),
  -- 资源状态一致性约束：
  -- status 不能只是一个孤立枚举值，必须和提交、审核、发布、下架时间相匹配。
  constraint course_resources_status_consistency_chk check (
    (
      status = 'draft'
      and submitted_at is null
      and reviewed_by is null
      and reviewed_at is null
      and review_comment is null
      and published_at is null
      and unpublished_at is null
    )
    or
    (
      status = 'pending'
      and submitted_at is not null
      and reviewed_by is null
      and reviewed_at is null
      and review_comment is null
      and published_at is null
      and unpublished_at is null
    )
    or
    (
      status = 'rejected'
      and submitted_at is not null
      and reviewed_at is not null
      and review_comment is not null
      and published_at is null
      and unpublished_at is null
    )
    or
    (
      status = 'published'
      and submitted_at is not null
      and reviewed_at is not null
      and published_at is not null
      and unpublished_at is null
    )
    or
    (
      status = 'unpublished'
      and submitted_at is not null
      and reviewed_at is not null
      and published_at is not null
      and unpublished_at is not null
    )
  )
);

create index if not exists course_resources_status_idx on public.course_resources(status);
create index if not exists course_resources_major_id_idx on public.course_resources(major_id);
create index if not exists course_resources_course_id_idx on public.course_resources(course_id);
create index if not exists course_resources_created_by_idx on public.course_resources(created_by);
create index if not exists course_resources_download_count_idx on public.course_resources(download_count);
-- 文件资源去重：同一课程下，相同 sha256 的未软删除文件只能存在一份。
create unique index if not exists course_resources_course_sha256_active_uq
  on public.course_resources(course_id, sha256)
  where deleted_at is null and resource_type = 'file';
-- 外链资源去重：同一课程下，相同规范化 URL 的未软删除链接只能存在一份。
create unique index if not exists course_resources_course_link_active_uq
  on public.course_resources(course_id, link_url_normalized)
  where deleted_at is null and resource_type = 'link';

do $$ begin
  create trigger course_resources_set_updated_at
  before update on public.course_resources
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 最佳推荐表。
-- 不把最佳推荐做成 course_resources.is_best，是因为还要记录推荐人 best_by 和推荐时间 best_at。
-- resource_id 作为主键，表示一个资源最多一条最佳推荐事实。
create table if not exists public.course_resource_bests (
  resource_id uuid primary key references public.course_resources(id) on delete cascade,
  best_by uuid not null references auth.users(id) on delete restrict,
  best_at timestamptz not null default now()
);

create index if not exists course_resource_bests_best_at_idx on public.course_resource_bests(best_at);

-- 下载事件表：每发生一次下载就追加一条事实记录。
-- 它用于时间窗口统计、审计和排行榜分析。
create table if not exists public.course_resource_download_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.course_resources(id) on delete cascade,
  -- user_id 允许为空；用户删除后保留下载事实，只把用户引用置空。
  user_id uuid null references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  ip text null,
  user_agent text null
);

create index if not exists course_resource_download_events_resource_id_idx
  on public.course_resource_download_events(resource_id);
create index if not exists course_resource_download_events_occurred_at_idx
  on public.course_resource_download_events(occurred_at);
create index if not exists course_resource_download_events_user_id_idx
  on public.course_resource_download_events(user_id);

-- 积分事件表：资源审核通过、被设为最佳时，给资源作者记积分。
-- 这是一张事实表，不把积分直接覆盖到资源表里，便于追溯每次加分原因。
create table if not exists public.course_resource_score_events (
  id uuid primary key default gen_random_uuid(),
  -- user_id 是被加分用户；后面的复合外键保证它必须等于资源作者 created_by。
  user_id uuid not null references auth.users(id) on delete cascade,
  major_id uuid not null references public.majors(id) on delete restrict,
  resource_id uuid not null references public.course_resources(id) on delete cascade,
  event_type public.course_resource_score_event_type not null,
  delta integer not null,
  occurred_at timestamptz not null default now(),
  -- 当前积分事件都是正向加分。
  constraint course_resource_score_events_delta_chk check (delta > 0),
  -- 防重复加分：同一作者、同一资源、同一事件类型只能有一条记录。
  constraint course_resource_score_events_first_uq unique (user_id, resource_id, event_type),
  -- 复合外键：积分事件 major_id 必须等于资源 major_id。
  constraint course_resource_score_events_resource_major_fk
    foreign key (resource_id, major_id)
    references public.course_resources(id, major_id)
    on update cascade
    on delete cascade,
  -- 复合外键：积分事件 user_id 必须等于资源作者 created_by。
  -- 即使手工插入积分，也不能把分加给错误用户。
  constraint course_resource_score_events_resource_user_fk
    foreign key (resource_id, user_id)
    references public.course_resources(id, created_by)
    on update cascade
    on delete cascade
);

create index if not exists course_resource_score_events_resource_id_idx
  on public.course_resource_score_events(resource_id);
create index if not exists course_resource_score_events_major_id_idx
  on public.course_resource_score_events(major_id);
create index if not exists course_resource_score_events_user_id_idx
  on public.course_resource_score_events(user_id);
create index if not exists course_resource_score_events_occurred_at_idx
  on public.course_resource_score_events(occurred_at);

create or replace function public.course_resource_best_requires_published()
returns trigger
language plpgsql
as $$
declare
  v_status public.course_resource_status;
begin
  -- 普通 CHECK 不能查询另一张表，所以“最佳推荐必须对应已发布资源”用触发器实现。
  select cr.status
    into v_status
  from public.course_resources cr
  where cr.id = new.resource_id;

  if v_status is null then
    return new;
  end if;

  -- 只有 published 资源允许写入 course_resource_bests。
  if v_status <> 'published' then
    raise exception using
      errcode = '23514',
      message = 'course resource best requires published status',
      constraint = 'course_resource_bests_resource_published_chk';
  end if;

  return new;
end;
$$;

do $$ begin
  create trigger course_resource_bests_require_published_trg
  before insert or update on public.course_resource_bests
  for each row execute function public.course_resource_best_requires_published();
exception when duplicate_object then null; end $$;

create or replace function public.course_resource_drop_best_when_not_published()
returns trigger
language plpgsql
as $$
begin
  -- 资源离开 published 状态后，自动撤销最佳推荐，避免“未发布资源仍是最佳”的脏数据。
  if new.status <> 'published' then
    delete from public.course_resource_bests
    where resource_id = new.id;
  end if;

  return new;
end;
$$;

do $$ begin
  create trigger course_resources_drop_best_on_status_change_trg
  after update of status on public.course_resources
  for each row
  when (old.status is distinct from new.status)
  execute function public.course_resource_drop_best_when_not_published();
exception when duplicate_object then null; end $$;

-- ============================================================
-- 8. RLS 与最小策略
-- ============================================================

-- RLS = Row Level Security（行级安全）。
-- 这里统一启用 RLS，默认不开放客户端直连访问；具体管理端访问主要由服务层控制。
alter table public.app_config enable row level security;
alter table public.departments enable row level security;
alter table public.department_closure enable row level security;
alter table public.positions enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_positions enable row level security;
alter table public.user_departments enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.app_modules enable row level security;
alter table public.data_scope_modules enable row level security;
alter table public.role_data_scopes enable row level security;
alter table public.role_data_scope_departments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.facility_buildings enable row level security;
alter table public.facility_rooms enable row level security;
alter table public.facility_reservations enable row level security;
alter table public.facility_reservation_participants enable row level security;
alter table public.facility_bans enable row level security;
alter table public.majors enable row level security;
alter table public.major_leads enable row level security;
alter table public.courses enable row level security;
alter table public.course_resources enable row level security;
alter table public.course_resource_bests enable row level security;
alter table public.course_resource_download_events enable row level security;
alter table public.course_resource_score_events enable row level security;

drop policy if exists profiles_select_own on public.profiles;
-- 最小自助策略：已登录用户可以读取自己的 profile。
create policy profiles_select_own on public.profiles
for select to authenticated
using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
-- 最小自助策略：已登录用户可以更新自己的 profile。
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ============================================================
-- 9. 空库最小种子数据
-- ============================================================

-- 这些 seed 不是业务测试数据，而是平台运行需要的基础字典：
-- 配置项、角色、权限码、模块字典。
insert into public.app_config (key, value)
values
  ('registration.requiresApproval', 'false'::jsonb),
  ('facility.auditRequired', 'false'::jsonb),
  ('facility.maxDurationHours', '72'::jsonb),
  ('courseResources.score.approveDelta', '5'::jsonb),
  ('courseResources.score.bestDelta', '10'::jsonb)
on conflict (key) do nothing;

insert into public.roles (code, name, description)
values
  ('user', '普通用户', '默认角色'),
  ('staff', '工作人员', '可审核预约等'),
  ('major_lead', '专业负责人', '负责某些专业的课程资源运营与审核'),
  ('admin', '管理员', '生活平台管理员'),
  ('super_admin', '超级管理员', '系统最高权限')
on conflict (code) do nothing;

insert into public.permissions (code, description)
values
  ('campus:*:*', '系统全量权限（通配；仅 super_admin）'),
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
  ('campus:config:update', '平台配置修改'),
  ('campus:facility:*', '功能房预约（全量）'),
  ('campus:facility:review', '预约审核（通过/驳回）'),
  ('campus:facility:stats', '预约统计/榜单查询'),
  ('campus:facility:config', '功能房模块配置（审核开关/最长时长）'),
  ('campus:facility:ban', '功能房模块封禁（封禁/解封）'),
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

insert into public.app_modules (code, name, enabled, sort, remark)
values
  ('resource', '课程资源', true, 30, '课程资源分享模块'),
  ('facility', '功能房预约', true, 40, '预约与审核模块'),
  ('user', '用户', true, 900, '基础设施模块'),
  ('role', '角色', true, 910, '基础设施模块'),
  ('permission', '权限字典', true, 920, '基础设施模块'),
  ('department', '部门', true, 930, '基础设施模块'),
  ('position', '岗位', true, 940, '基础设施模块'),
  ('audit', '审计日志', true, 950, '基础设施模块'),
  ('config', '平台配置', true, 960, '基础设施模块')
on conflict (code) do nothing;

insert into public.data_scope_modules (module_code)
values ('user')
on conflict (module_code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('campus:facility:review')
where r.code = 'staff'
on conflict do nothing;

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

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('campus:facility:*', 'campus:resource:*')
where r.code = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('campus:*:*')
where r.code = 'super_admin'
on conflict do nothing;
