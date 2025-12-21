-- 数字图书馆（library）：用户投稿 / 馆员审核 / 多格式资产 / 收藏 / 下载计数与榜单
-- 约定：
-- - 仅新增结构与可逆默认数据（角色/权限）；不执行破坏性数据操作
-- - Console 侧访问控制由 BFF 实现；RLS 默认开启但不下发策略（避免直连）

-- 枚举：图书状态
do $$ begin
  create type public.library_book_status as enum ('draft', 'pending', 'published', 'rejected', 'unpublished');
exception
  when duplicate_object then null;
end $$;

-- 枚举：资产类型
do $$ begin
  create type public.library_book_asset_type as enum ('file', 'link');
exception
  when duplicate_object then null;
end $$;

-- 枚举：文件格式
do $$ begin
  create type public.library_book_file_format as enum ('pdf', 'epub', 'mobi', 'zip');
exception
  when duplicate_object then null;
end $$;

-- 图书主体
create table if not exists public.library_books (
  id uuid primary key default gen_random_uuid(),
  isbn13 text not null,
  title text not null,
  author text not null,
  summary text null,
  keywords text null,

  status public.library_book_status not null default 'draft',
  submitted_at timestamptz null,

  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  review_comment text null,

  published_at timestamptz null,
  unpublished_at timestamptz null,

  download_count integer not null default 0,
  last_download_at timestamptz null,

  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid null references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint library_books_isbn13_chk check (isbn13 ~ '^[0-9]{13}$'),
  constraint library_books_download_count_chk check (download_count >= 0)
);

create unique index if not exists library_books_isbn13_uq on public.library_books(isbn13);
create index if not exists library_books_status_idx on public.library_books(status);
create index if not exists library_books_created_by_idx on public.library_books(created_by);
create index if not exists library_books_download_count_idx on public.library_books(download_count);
create index if not exists library_books_last_download_at_idx on public.library_books(last_download_at);

do $$ begin
  create trigger library_books_set_updated_at before update on public.library_books
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 图书资产（多格式 + 外链）
create table if not exists public.library_book_assets (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.library_books(id) on delete cascade,
  asset_type public.library_book_asset_type not null,

  -- file
  file_format public.library_book_file_format null,
  file_bucket text null,
  file_key text null,
  file_name text null,
  file_size integer null,
  content_type text null,

  -- link
  link_url text null,
  link_url_normalized text null,

  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint library_book_assets_file_size_chk check (file_size is null or file_size >= 0),
  constraint library_book_assets_file_or_link_chk check (
    (
      asset_type = 'file'
      and file_format is not null
      and file_bucket is not null
      and file_key is not null
      and file_name is not null
      and file_size is not null
      and link_url is null
      and link_url_normalized is null
    )
    or
    (
      asset_type = 'link'
      and link_url is not null
      and link_url_normalized is not null
      and file_format is null
      and file_bucket is null
      and file_key is null
      and file_name is null
      and file_size is null
      and content_type is null
    )
  )
);

create index if not exists library_book_assets_book_id_idx on public.library_book_assets(book_id);
create index if not exists library_book_assets_asset_type_idx on public.library_book_assets(asset_type);
create index if not exists library_book_assets_file_format_idx on public.library_book_assets(file_format);
create index if not exists library_book_assets_created_by_idx on public.library_book_assets(created_by);

-- 同一本书同一文件格式最多 1 份（link 的 file_format 为 null，不参与冲突）
create unique index if not exists library_book_assets_book_file_format_uq
  on public.library_book_assets(book_id, file_format);

-- 外链在同一本书维度按规范化 URL 去重
create unique index if not exists library_book_assets_book_link_uq
  on public.library_book_assets(book_id, link_url_normalized);

do $$ begin
  create trigger library_book_assets_set_updated_at before update on public.library_book_assets
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 收藏（幂等）
create table if not exists public.library_book_favorites (
  book_id uuid not null references public.library_books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

create index if not exists library_book_favorites_user_id_idx on public.library_book_favorites(user_id);

-- 下载事件（事实表：用于 days 窗口统计与审计）
create table if not exists public.library_book_download_events (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.library_books(id) on delete cascade,
  asset_id uuid null references public.library_book_assets(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  ip text null,
  user_agent text null
);

create index if not exists library_book_download_events_book_id_idx on public.library_book_download_events(book_id);
create index if not exists library_book_download_events_occurred_at_idx on public.library_book_download_events(occurred_at);
create index if not exists library_book_download_events_user_id_idx on public.library_book_download_events(user_id);

-- 角色：librarian
insert into public.roles (code, name, description)
values ('librarian', '图书管理员', '负责数字图书馆内容审核与运营')
on conflict (code) do nothing;

-- 权限字典：数字图书馆（module=library）
insert into public.permissions (code, description)
values
  ('campus:library:*', '数字图书馆（全量）'),
  ('campus:library:list', '图书列表/查询（管理端）'),
  ('campus:library:read', '图书详情查看（管理端）'),
  ('campus:library:review', '图书审核（通过/驳回）'),
  ('campus:library:offline', '图书下架'),
  ('campus:library:stats', '图书榜单/统计（管理端）'),
  ('campus:library:delete', '图书硬删除（删库+清理存储对象，仅 admin/super_admin）')
on conflict (code) do nothing;

-- 角色-权限：librarian
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'campus:library:list',
  'campus:library:read',
  'campus:library:review',
  'campus:library:offline',
  'campus:library:stats'
)
where r.code = 'librarian'
on conflict do nothing;

-- 角色-权限：admin / super_admin（library 模块全量）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('campus:library:*')
where r.code in ('admin', 'super_admin')
on conflict do nothing;

-- RLS：新增表启用（默认不开放直连；策略在实现阶段补齐）
alter table public.library_books enable row level security;
alter table public.library_book_assets enable row level security;
alter table public.library_book_favorites enable row level security;
alter table public.library_book_download_events enable row level security;
