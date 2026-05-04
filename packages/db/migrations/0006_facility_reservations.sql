-- 功能房预约（楼房/房间/预约/参与人/封禁/配置/权限）
-- 约定：
-- - 仅新增结构与可逆默认数据（角色/权限/配置）；不执行破坏性数据操作
-- - Console 侧访问控制由 BFF 实现；RLS 默认开启但不下发策略（避免直连）

-- 【0基础速读】
-- 枚举 = 数据库里提前规定好一组固定取值。
-- 这里规定预约状态只能是 pending/approved/rejected/cancelled 四种，
-- 避免有人写出 pendding、pass、done 这种不统一的状态文本。
-- 答辩口径：这是“用户定义完整性 / 域完整性”的例子。
do $$ begin
  create type public.facility_reservation_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception
  when duplicate_object then null;
end $$;

-- 【楼房表】
-- 楼房是功能房的上层空间实体，比如“逸夫楼”“实验楼”。
-- enabled/sort/remark 用于管理状态、排序和备注。
-- deleted_at 表示软删除：记录还在数据库里，但业务上不再显示。
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

-- 同一个有效楼房名不能重复；已软删除的历史记录不参与唯一性判断。
-- 这就是“部分唯一索引”：只约束 where deleted_at is null 的那部分数据。
create unique index if not exists facility_buildings_name_active_uq on public.facility_buildings(name) where deleted_at is null;
create index if not exists facility_buildings_enabled_idx on public.facility_buildings(enabled);
create index if not exists facility_buildings_sort_idx on public.facility_buildings(sort);

-- 自动维护 updated_at：只要更新楼房记录，就把 updated_at 改成当前时间。
do $$ begin
  create trigger facility_buildings_set_updated_at before update on public.facility_buildings
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 【房间表】
-- 房间属于某栋楼，所以 building_id 是外键。
-- on delete restrict 表示：如果某栋楼下面还有房间，就不允许直接物理删除楼房。
-- 这体现“参照完整性”：房间引用的楼房必须真实存在。
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
  -- 容量可以为空；如果填了，就不能是负数。
  constraint facility_rooms_capacity_chk check (capacity is null or capacity >= 0)
);

-- 房间名不是全校唯一，而是“同一栋楼 + 同一楼层 + 同一房间名”唯一。
-- 例：A楼可以有 101，B楼也可以有 101，所以不能只让 name 全局唯一。
create unique index if not exists facility_rooms_name_active_uq
  on public.facility_rooms(building_id, floor_no, name)
  where deleted_at is null;

-- 这些索引用于常见查询：
-- - building_id：查某栋楼下所有房间
-- - (building_id, floor_no)：查某栋楼某层所有房间
-- - enabled/sort：按启用状态过滤、按排序字段展示
create index if not exists facility_rooms_building_id_idx on public.facility_rooms(building_id);
create index if not exists facility_rooms_building_floor_idx on public.facility_rooms(building_id, floor_no);
create index if not exists facility_rooms_enabled_idx on public.facility_rooms(enabled);
create index if not exists facility_rooms_sort_idx on public.facility_rooms(sort);

do $$ begin
  create trigger facility_rooms_set_updated_at before update on public.facility_rooms
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 【预约表：功能房模块最核心的事务表】
-- 一条预约表示：某个申请人，在某个时间段，为某个用途，占用某个房间。
-- 注意：预约表只存 room_id，不重复存楼房名/房间名。
-- 答辩口径：这样避免房间名称修改时多处更新，符合 3NF 的设计思路。
create table if not exists public.facility_reservations (
  id uuid primary key default gen_random_uuid(),
  -- 预约必须指向真实房间；有预约历史的房间不允许随便物理删除。
  room_id uuid not null references public.facility_rooms(id) on delete restrict,
  -- applicant_id 是业务上的申请人，必须是真实用户。
  applicant_id uuid not null references auth.users(id) on delete restrict,
  purpose text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.facility_reservation_status not null,

  -- reviewed_* 是“审核痕迹”：谁审核、什么时候审核。
  -- on delete set null 表示：审核人账号如果后来被删除，预约记录仍要保留，只把审核人字段置空。
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  -- reject_reason 只应该在 rejected 状态下出现，用来说明为什么被驳回。
  reject_reason text null,

  -- cancelled_* 是“取消痕迹”：谁取消、什么时候取消、为什么取消。
  -- 它们不是为了预约占用本身，而是为了记录预约生命周期。
  cancelled_by uuid null references auth.users(id) on delete set null,
  cancelled_at timestamptz null,
  cancel_reason text null,

  -- created_by 是“这条数据库记录是谁创建的”。
  -- 普通用户自己预约时通常等于 applicant_id；
  -- 但如果后续有管理员代申请、数据补录，两者语义就不同。
  created_by uuid not null references auth.users(id) on delete restrict,
  -- updated_by 是最后修改人；删除该用户不应删除历史预约，所以 set null。
  updated_by uuid null references auth.users(id) on delete set null,

  -- created_at/updated_at 是记录创建时间和最后更新时间。
  -- 它们用于排序、审计、统计，也能判断记录是否被修改过。
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 基础时间合法性：结束时间必须晚于开始时间。
  constraint facility_reservations_time_chk check (end_at > start_at),
  -- 初版状态一致性检查：
  -- pending：未审核、未取消
  -- approved：必须有审核时间
  -- rejected：必须有审核时间和驳回原因
  -- cancelled：必须有取消时间，且不能同时有驳回原因
  -- 后续 0014 迁移会把这个约束升级得更严格，增加 reviewed_by/cancelled_by 的配套检查。
  constraint facility_reservations_review_chk check (
    (status = 'pending' and reviewed_at is null and reject_reason is null and cancelled_at is null)
    or (status = 'approved' and reviewed_at is not null and reject_reason is null and cancelled_at is null)
    or (status = 'rejected' and reviewed_at is not null and reject_reason is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and reject_reason is null)
  )
);

-- 常见查询索引：
-- room_id：查某房间预约
-- applicant_id：查某人的预约
-- status：按待审核/已通过等状态过滤
-- (room_id, start_at, end_at)：查房间时间轴、判断时间窗口冲突
create index if not exists facility_reservations_room_id_idx on public.facility_reservations(room_id);
create index if not exists facility_reservations_applicant_id_idx on public.facility_reservations(applicant_id);
create index if not exists facility_reservations_status_idx on public.facility_reservations(status);
create index if not exists facility_reservations_time_room_idx on public.facility_reservations(room_id, start_at, end_at);

-- 优化重叠查询：仅对 pending/approved 建索引。
-- 因为只有 pending/approved 会占用或预占房间；
-- rejected/cancelled 是历史记录，不应该参与冲突判断。
create index if not exists facility_reservations_room_active_time_idx
  on public.facility_reservations(room_id, start_at, end_at)
  where status in ('pending', 'approved');

  -- 自动维护 updated_at。
  do $$ begin
    create trigger facility_reservations_set_updated_at before update on public.facility_reservations
    for each row execute function public.set_updated_at();
  exception when duplicate_object then null; end $$;

-- 【参与人表】
-- 一条预约可以有多个参与人，一个用户也可以参与多条预约，所以这是多对多关系。
-- 不把参与人写成 "u1,u2,u3" 字符串，是为了满足 1NF，并方便外键约束和查询。
create table if not exists public.facility_reservation_participants (
  -- 预约删除后，参与人明细跟着删除，所以 cascade 合理。
  reservation_id uuid not null references public.facility_reservations(id) on delete cascade,
  -- 参与人必须是真实用户；用户被删除时，不允许直接破坏历史参与关系。
  user_id uuid not null references auth.users(id) on delete restrict,
  -- is_applicant 标记这条参与人记录是不是申请人本人。
  is_applicant boolean not null default false,
  created_at timestamptz not null default now(),
  -- 复合主键保证：同一预约中，同一用户只能出现一次。
  primary key (reservation_id, user_id)
);

create index if not exists facility_reservation_participants_user_id_idx on public.facility_reservation_participants(user_id);
-- 每条预约最多只能有一个 is_applicant=true 的参与人。
-- “至少一个申请人”和“申请人必须等于 applicant_id”在 0012 的延迟触发器中继续保证。
create unique index if not exists facility_reservation_participants_applicant_uq
  on public.facility_reservation_participants(reservation_id)
  where is_applicant;

-- 【封禁表】
-- 封禁是模块治理记录，不放在用户主表里。
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
-- 部分唯一索引：同一用户只能有一条 revoked_at is null 的封禁。
-- 答辩边界：自然过期但未显式撤销的封禁，仍然会占用这个唯一索引位置。
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
