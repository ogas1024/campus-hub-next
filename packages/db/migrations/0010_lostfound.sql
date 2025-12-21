-- 失物招领（lostfound）
-- 约定：
-- - 仅新增结构与可逆默认数据（角色/权限）；不执行破坏性数据操作
-- - Console 侧访问控制由 BFF 实现；RLS 默认开启但不下发策略（避免直连）

do $$ begin
  create type public.lostfound_item_type as enum ('lost', 'found');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.lostfound_item_status as enum ('pending', 'published', 'rejected', 'offline');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.lostfound_items (
  id uuid primary key default gen_random_uuid(),
  type public.lostfound_item_type not null,
  title text not null,
  content text not null,
  location text null,
  occurred_at timestamptz null,
  contact_info text null,

  status public.lostfound_item_status not null default 'pending',
  publish_at timestamptz null,

  reject_reason text null,
  offline_reason text null,

  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,

  offlined_by uuid null references auth.users(id) on delete set null,
  offlined_at timestamptz null,

  solved_at timestamptz null,

  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid null references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists lostfound_items_status_idx on public.lostfound_items(status);
create index if not exists lostfound_items_publish_at_idx on public.lostfound_items(publish_at);
create index if not exists lostfound_items_created_by_idx on public.lostfound_items(created_by);
create index if not exists lostfound_items_solved_at_idx on public.lostfound_items(solved_at);
create index if not exists lostfound_items_created_at_idx on public.lostfound_items(created_at);
create index if not exists lostfound_items_status_publish_at_idx on public.lostfound_items(status, publish_at);

do $$ begin
  create trigger lostfound_items_set_updated_at before update on public.lostfound_items
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

create table if not exists public.lostfound_item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.lostfound_items(id) on delete cascade,
  bucket text not null,
  key text not null,
  sort_no integer not null default 0,
  created_at timestamptz not null default now(),
  constraint lostfound_item_images_item_key_uq unique (item_id, key)
);

create index if not exists lostfound_item_images_item_id_idx on public.lostfound_item_images(item_id);
create index if not exists lostfound_item_images_sort_no_idx on public.lostfound_item_images(sort_no);

-- 权限字典：失物招领（module=lostfound）
insert into public.permissions (code, description)
values
  ('campus:lostfound:*', '失物招领（全量）'),
  ('campus:lostfound:list', '列表与详情查看（管理端）'),
  ('campus:lostfound:review', '审核（通过/驳回）'),
  ('campus:lostfound:offline', '下架'),
  ('campus:lostfound:restore', '恢复为待审'),
  ('campus:lostfound:delete', '软删清理（管理端）')
on conflict (code) do nothing;

-- 角色-权限：staff（失物招领模块运营）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'campus:lostfound:list',
  'campus:lostfound:review',
  'campus:lostfound:offline',
  'campus:lostfound:restore'
)
where r.code = 'staff'
on conflict do nothing;

-- 角色-权限：admin / super_admin（失物招领模块全量）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('campus:lostfound:*')
where r.code in ('admin', 'super_admin')
on conflict do nothing;

-- RLS：新增表启用（默认不开放直连；策略在实现阶段补齐）
alter table public.lostfound_items enable row level security;
alter table public.lostfound_item_images enable row level security;
