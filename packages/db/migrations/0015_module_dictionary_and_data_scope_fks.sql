-- 数据库课程设计增强（第四批）：
-- 1) 为系统模块建立可扩展的主数据字典 app_modules
-- 2) 用 data_scope_modules 表示“支持数据权限”的模块能力
-- 3) role_data_scopes.module 不再是自由文本，而是外键到 data_scope_modules
-- 4) collect_tasks.module 也复用模块字典，避免继续自由扩散
-- 答辩重点：把自由文本改成字典表 + 外键，是典型的参照完整性增强，能防止 module 写错。

-- 模块字典表：系统里出现的模块 code 都先登记在这里。
-- 这样 facility/resource/user 等模块名有统一来源，不会在不同表里各写各的。
create table if not exists public.app_modules (
  -- code 是模块主键，例如 facility、resource；用 text 是为了保持可读。
  code text primary key,
  name text not null,
  enabled boolean not null default true,
  sort integer not null default 0,
  remark text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 用户定义完整性：模块 code 必须小写字母开头，只允许小写字母、数字、下划线。
  constraint app_modules_code_format_chk check (code ~ '^[a-z][a-z0-9_]*$')
);

-- name 也唯一，避免两个模块显示同一个中文名造成管理端混淆。
create unique index if not exists app_modules_name_uq on public.app_modules(name);
create index if not exists app_modules_enabled_idx on public.app_modules(enabled);
create index if not exists app_modules_sort_idx on public.app_modules(sort);

do $$ begin
  create trigger app_modules_set_updated_at before update on public.app_modules
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 数据权限模块表：不是所有模块都需要“按部门/本人/全部”这种数据范围控制。
-- 这张表只列出支持数据权限的模块，是 app_modules 的一个子集。
create table if not exists public.data_scope_modules (
  module_code text primary key,
  created_at timestamptz not null default now(),
  -- 外键指向 app_modules，保证数据权限模块一定是系统已登记模块。
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
-- 先检查再加外键，是数据库迁移中的常见做法：不能把不合法历史数据硬塞进新约束。
do $$
declare
  v_invalid_modules text;
begin
  -- string_agg 把所有非法 module 拼成一个字符串，便于错误信息一次性说明有哪些脏值。
  select string_agg(distinct r.module, ', ' order by r.module)
    into v_invalid_modules
  from public.role_data_scopes r
  left join public.data_scope_modules m
    on m.module_code = r.module
  where m.module_code is null;

  if v_invalid_modules is not null then
    -- errcode 23503 是 foreign_key_violation，表示这是外键一致性问题。
    raise exception using
      errcode = '23503',
      message = 'role_data_scopes contains modules not registered in data_scope_modules: ' || v_invalid_modules,
      constraint = 'role_data_scopes_module_fk';
  end if;
end $$;

do $$ begin
  -- 从这里开始，role_data_scopes.module 不再是随便写的 text，必须引用 data_scope_modules.module_code。
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
-- collect_tasks 不属于本次答辩重点；这里的思路和 role_data_scopes 一样，都是把 module 收敛到字典表。
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
