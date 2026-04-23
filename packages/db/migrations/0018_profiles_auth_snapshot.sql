alter table public.profiles
  add column if not exists email text null,
  add column if not exists email_confirmed_at timestamptz null,
  add column if not exists auth_banned_until timestamptz null,
  add column if not exists auth_deleted_at timestamptz null;

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_auth_banned_until_idx on public.profiles(auth_banned_until);
create index if not exists profiles_auth_deleted_at_idx on public.profiles(auth_deleted_at);

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

  insert into public.user_roles (user_id, role_id)
  select new.id, r.id
  from public.roles r
  where r.code = 'user'
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
exception
  when duplicate_object then null;
end $$;
