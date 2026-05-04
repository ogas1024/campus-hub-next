-- profiles 认证快照增强：
-- auth.users 是认证系统表，profiles 是业务用户资料表。
-- 这里把常用认证状态同步到 profiles，方便平台基础模块查询用户状态，同时保持 auth.users 为源头。
alter table public.profiles
  -- 邮箱快照：用于用户列表、审计展示等查询，不需要每次都直接查 auth.users。
  add column if not exists email text null,
  -- 邮箱验证时间：为空表示还没验证。
  add column if not exists email_confirmed_at timestamptz null,
  -- 封禁到期时间：为空表示没有封禁。
  add column if not exists auth_banned_until timestamptz null,
  -- 认证侧删除时间：用于保留业务侧对已删除账号的状态认知。
  add column if not exists auth_deleted_at timestamptz null;

-- 这些字段常用于用户管理筛选，所以单独建索引。
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_auth_banned_until_idx on public.profiles(auth_banned_until);
create index if not exists profiles_auth_deleted_at_idx on public.profiles(auth_deleted_at);

-- 回填历史用户：把 auth.users 里已有的认证信息同步到 profiles。
-- is distinct from 能正确比较 null：两个 null 视为相同，一个 null 一个非 null 视为不同。
update public.profiles p
set
  email = u.email,
  email_confirmed_at = u.email_confirmed_at,
  auth_banned_until = u.banned_until,
  auth_deleted_at = u.deleted_at,
  last_login_at = coalesce(p.last_login_at, u.last_sign_in_at)
from auth.users u
where u.id = p.id
  and (
    p.email is distinct from u.email
    or p.email_confirmed_at is distinct from u.email_confirmed_at
    or p.auth_banned_until is distinct from u.banned_until
    or p.auth_deleted_at is distinct from u.deleted_at
    or (p.last_login_at is null and u.last_sign_in_at is not null)
  );

-- 重建新用户触发器函数：在创建 profile 时一并写入认证快照字段。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := coalesce(new.raw_user_meta_data->>'name', '');
  v_student_id text := coalesce(new.raw_user_meta_data->>'studentId', '');
  -- 注册审核开关来自 app_config，而不是写死在程序里。
  v_requires_approval boolean := public.get_config_bool('registration.requiresApproval', false);
  v_status public.profile_status;
begin
  if v_name = '' then
    raise exception 'name is required';
  end if;
  if v_student_id = '' then
    raise exception 'studentId is required';
  end if;

  -- 状态机入口：未验证邮箱 -> pending_email_verification；
  -- 已验证邮箱 -> 根据配置进入 pending_approval 或 active。
  if new.email_confirmed_at is null then
    v_status := 'pending_email_verification';
  else
    v_status := case when v_requires_approval then 'pending_approval' else 'active' end;
  end if;

  -- profiles 和 auth.users 是一对一关系；id 使用同一个 uuid。
  -- 这里同时写入 email、验证时间、封禁/删除状态这些认证快照。
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

  -- 每个新用户默认绑定普通用户角色，保证基础权限可用。
  insert into public.user_roles (user_id, role_id)
  select new.id, r.id
  from public.roles r
  where r.code = 'user'
  on conflict do nothing;

  return new;
end;
$$;

-- 认证信息同步函数：auth.users 发生关键字段变化时，把快照同步到 profiles。
create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- profiles 不是认证源头，所以这里只同步 auth.users 的最新认证字段。
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
  -- 只监听这些认证字段的变化，避免无关 update 也触发同步。
  create trigger on_auth_user_profile_sync
  after update of email, email_confirmed_at, banned_until, deleted_at, last_sign_in_at on auth.users
  for each row execute function public.sync_profile_from_auth_user();
exception
  when duplicate_object then null;
end $$;
