-- 功能房预约（楼房/房间/预约/参与人/封禁/配置/权限）
-- 约定：
-- - 仅新增结构与可逆默认数据（角色/权限/配置）；不执行破坏性数据操作
-- - Console 侧访问控制由 BFF 实现；RLS 默认开启但不下发策略（避免直连）

-- 枚举：预约状态
do $$ begin
  create type public.facility_reservation_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception
  when duplicate_object then null;
end $$;

-- 楼房
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

create unique index if not exists facility_buildings_name_active_uq on public.facility_buildings(name) where deleted_at is null;
create index if not exists facility_buildings_enabled_idx on public.facility_buildings(enabled);
create index if not exists facility_buildings_sort_idx on public.facility_buildings(sort);

do $$ begin
  create trigger facility_buildings_set_updated_at before update on public.facility_buildings
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 房间（含楼房与楼层）
create table if not exists public.facility_rooms (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.facility_buildings(id) on delete restrict,
  floor_no integer not null,
  name text not null,
  capacity integer null,
  enabled boolean not null default true,
  sort integer not null default 0,
  remark text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint facility_rooms_capacity_chk check (capacity is null or capacity >= 0)
);

create unique index if not exists facility_rooms_name_active_uq
  on public.facility_rooms(building_id, floor_no, name)
  where deleted_at is null;

create index if not exists facility_rooms_building_id_idx on public.facility_rooms(building_id);
create index if not exists facility_rooms_building_floor_idx on public.facility_rooms(building_id, floor_no);
create index if not exists facility_rooms_enabled_idx on public.facility_rooms(enabled);
create index if not exists facility_rooms_sort_idx on public.facility_rooms(sort);

do $$ begin
  create trigger facility_rooms_set_updated_at before update on public.facility_rooms
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 预约
create table if not exists public.facility_reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.facility_rooms(id) on delete restrict,
  applicant_id uuid not null references auth.users(id) on delete restrict,
  purpose text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.facility_reservation_status not null,

  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  reject_reason text null,

  cancelled_by uuid null references auth.users(id) on delete set null,
  cancelled_at timestamptz null,
  cancel_reason text null,

  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid null references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint facility_reservations_time_chk check (end_at > start_at),
  constraint facility_reservations_review_chk check (
    (status = 'pending' and reviewed_at is null and reject_reason is null and cancelled_at is null)
    or (status = 'approved' and reviewed_at is not null and reject_reason is null and cancelled_at is null)
    or (status = 'rejected' and reviewed_at is not null and reject_reason is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and reject_reason is null)
  )
);

create index if not exists facility_reservations_room_id_idx on public.facility_reservations(room_id);
create index if not exists facility_reservations_applicant_id_idx on public.facility_reservations(applicant_id);
create index if not exists facility_reservations_status_idx on public.facility_reservations(status);
create index if not exists facility_reservations_time_room_idx on public.facility_reservations(room_id, start_at, end_at);

-- 优化重叠查询：仅对 pending/approved 建索引
create index if not exists facility_reservations_room_active_time_idx
  on public.facility_reservations(room_id, start_at, end_at)
  where status in ('pending', 'approved');

do $$ begin
  create trigger facility_reservations_set_updated_at before update on public.facility_reservations
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 参与人（含申请人）
create table if not exists public.facility_reservation_participants (
  reservation_id uuid not null references public.facility_reservations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  is_applicant boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (reservation_id, user_id)
);

create index if not exists facility_reservation_participants_user_id_idx on public.facility_reservation_participants(user_id);
create unique index if not exists facility_reservation_participants_applicant_uq
  on public.facility_reservation_participants(reservation_id)
  where is_applicant;

-- 模块封禁（可到期/可永久；仅限制创建新预约）
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
  constraint facility_bans_revoked_chk check (revoked_at is null or revoked_at >= created_at)
);

create index if not exists facility_bans_user_id_idx on public.facility_bans(user_id);
create index if not exists facility_bans_revoked_at_idx on public.facility_bans(revoked_at);
create index if not exists facility_bans_expires_at_idx on public.facility_bans(expires_at);
create unique index if not exists facility_bans_user_active_uq on public.facility_bans(user_id) where revoked_at is null;

-- 配置默认值（可在线修改）
insert into public.app_config (key, value)
values
  ('facility.auditRequired', 'false'::jsonb),
  ('facility.maxDurationHours', '72'::jsonb)
on conflict (key) do nothing;

-- 权限字典：功能房预约（module=facility）
insert into public.permissions (code, description)
values
  ('campus:*:*', '系统全量权限（通配；仅 super_admin）'),
  ('campus:facility:*', '功能房预约（全量）'),
  ('campus:facility:review', '预约审核（通过/驳回）'),
  ('campus:facility:stats', '预约统计/榜单查询'),
  ('campus:facility:config', '功能房模块配置（审核开关/最长时长）'),
  ('campus:facility:ban', '功能房模块封禁（封禁/解封）')
on conflict (code) do nothing;

-- 角色-权限：staff（仅审核）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('campus:facility:review')
where r.code = 'staff'
on conflict do nothing;

-- 角色-权限：admin（生活平台能力：功能房全量；不含基础设施）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('campus:facility:*')
where r.code = 'admin'
on conflict do nothing;

-- 角色-权限：super_admin（系统通配）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('campus:*:*')
where r.code = 'super_admin'
on conflict do nothing;

-- admin：移除基础设施权限绑定（由 super_admin 兜底）
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'admin'
  and p.code in (
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
  );

-- RLS：新增表启用（默认不开放直连；策略在实现阶段补齐）
alter table public.facility_buildings enable row level security;
alter table public.facility_rooms enable row level security;
alter table public.facility_reservations enable row level security;
alter table public.facility_reservation_participants enable row level security;
alter table public.facility_bans enable row level security;

