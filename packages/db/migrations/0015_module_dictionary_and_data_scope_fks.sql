-- 数据库课程设计增强（第四批）：
-- 1) 为系统模块建立可扩展的主数据字典 app_modules
-- 2) 用 data_scope_modules 表示“支持数据权限”的模块能力
-- 3) role_data_scopes.module 不再是自由文本，而是外键到 data_scope_modules
-- 4) collect_tasks.module 也复用模块字典，避免继续自由扩散

create table if not exists public.app_modules (
  code text primary key,
  name text not null,
  enabled boolean not null default true,
  sort integer not null default 0,
  remark text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_modules_code_format_chk check (code ~ '^[a-z][a-z0-9_]*$')
);

create unique index if not exists app_modules_name_uq on public.app_modules(name);
create index if not exists app_modules_enabled_idx on public.app_modules(enabled);
create index if not exists app_modules_sort_idx on public.app_modules(sort);

do $$ begin
  create trigger app_modules_set_updated_at before update on public.app_modules
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

create table if not exists public.data_scope_modules (
  module_code text primary key,
  created_at timestamptz not null default now(),
  constraint data_scope_modules_module_code_fk
    foreign key (module_code) references public.app_modules(code) on delete restrict
);

-- 模块字典：这里记录“系统认可的业务/基础设施模块”。
insert into public.app_modules (code, name, enabled, sort, remark)
values
  ('notice', '通知公告', true, 10, '门户内容模块'),
  ('material', '材料收集', true, 20, 'Collect Engine 业务模块'),
  ('resource', '课程资源', true, 30, '课程资源分享模块'),
  ('facility', '功能房预约', true, 40, '预约与审核模块'),
  ('survey', '问卷', true, 50, '问卷发布与统计模块'),
  ('vote', '投票', true, 60, '投票发布与统计模块'),
  ('library', '数字图书馆', true, 70, '电子书/资料模块'),
  ('lostfound', '失物招领', true, 80, '失物/拾物审核模块'),
  ('user', '用户', true, 900, '基础设施模块'),
  ('role', '角色', true, 910, '基础设施模块'),
  ('permission', '权限字典', true, 920, '基础设施模块'),
  ('department', '部门', true, 930, '基础设施模块'),
  ('position', '岗位', true, 940, '基础设施模块'),
  ('audit', '审计日志', true, 950, '基础设施模块'),
  ('config', '平台配置', true, 960, '基础设施模块')
on conflict (code) do nothing;

-- 模块能力表：只有列在这里的模块，才允许配置数据权限范围。
insert into public.data_scope_modules (module_code)
values
  ('user'),
  ('notice'),
  ('material'),
  ('survey'),
  ('vote')
on conflict (module_code) do nothing;

-- 迁移前检查：若已有 role_data_scopes 使用了未注册的数据权限模块，则拒绝继续执行，
-- 避免把历史脏数据静默带入“合法模块集合”。
do $$
declare
  v_invalid_modules text;
begin
  select string_agg(distinct r.module, ', ' order by r.module)
    into v_invalid_modules
  from public.role_data_scopes r
  left join public.data_scope_modules m
    on m.module_code = r.module
  where m.module_code is null;

  if v_invalid_modules is not null then
    raise exception using
      errcode = '23503',
      message = 'role_data_scopes contains modules not registered in data_scope_modules: ' || v_invalid_modules,
      constraint = 'role_data_scopes_module_fk';
  end if;
end $$;

do $$ begin
  alter table public.role_data_scopes
    add constraint role_data_scopes_module_fk
    foreign key (module)
    references public.data_scope_modules(module_code)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

-- collect_tasks 也复用模块字典，但当前 Supabase 验证环境未必已部署 collect engine；
-- 因此这里用 to_regclass + alter table if exists，保证迁移在裁剪环境中也可安全执行。
do $$
declare
  v_invalid_modules text;
begin
  if to_regclass('public.collect_tasks') is null then
    return;
  end if;

  select string_agg(distinct c.module, ', ' order by c.module)
    into v_invalid_modules
  from public.collect_tasks c
  left join public.app_modules m
    on m.code = c.module
  where m.code is null;

  if v_invalid_modules is not null then
    raise exception using
      errcode = '23503',
      message = 'collect_tasks contains modules not registered in app_modules: ' || v_invalid_modules,
      constraint = 'collect_tasks_module_fk';
  end if;
end $$;

do $$ begin
  alter table if exists public.collect_tasks
    add constraint collect_tasks_module_fk
    foreign key (module)
    references public.app_modules(code)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

alter table public.app_modules enable row level security;
alter table public.data_scope_modules enable row level security;
