-- 投票（多题单选/多选、maxChoices、置顶、延期、归档、结果统计）
-- 约定：
-- - 仅新增结构与可逆默认数据（权限/授权）；不执行破坏性数据操作
-- - Portal 必须登录；匿名仅影响“管理端/公示”是否展示身份（MVP 不提供实名名单）
-- - Console 侧访问控制由 BFF 实现；RLS 默认开启但不下发策略（避免直连）

-- 枚举：投票状态
do $$ begin
  create type public.vote_status as enum ('draft', 'published', 'closed');
exception
  when duplicate_object then null;
end $$;

-- 枚举：投票可见范围类型
do $$ begin
  create type public.vote_scope_type as enum ('role', 'department', 'position');
exception
  when duplicate_object then null;
end $$;

-- 枚举：题型
do $$ begin
  create type public.vote_question_type as enum ('single', 'multi');
exception
  when duplicate_object then null;
end $$;

-- 投票（头）
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description_md text not null default '',
  status public.vote_status not null default 'draft',

  start_at timestamptz not null,
  end_at timestamptz not null,

  anonymous_responses boolean not null default false,
  visible_all boolean not null default true,

  pinned boolean not null default false,
  pinned_at timestamptz null,

  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid null references auth.users(id) on delete set null,

  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint votes_time_chk check (end_at > start_at)
);

create index if not exists votes_status_idx on public.votes(status);
create index if not exists votes_time_idx on public.votes(start_at, end_at);
create index if not exists votes_pinned_at_idx on public.votes(pinned_at);
create index if not exists votes_created_by_idx on public.votes(created_by);
create index if not exists votes_archived_at_idx on public.votes(archived_at);

do $$ begin
  create trigger votes_set_updated_at before update on public.votes
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 可见范围（沿用公告/问卷口径：visible_all OR scopes 命中）
create table if not exists public.vote_scopes (
  vote_id uuid not null references public.votes(id) on delete cascade,
  scope_type public.vote_scope_type not null,
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (vote_id, scope_type, ref_id)
);

create index if not exists vote_scopes_vote_id_idx on public.vote_scopes(vote_id);

-- 题目（多题；单选/多选）
create table if not exists public.vote_questions (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.votes(id) on delete cascade,
  question_type public.vote_question_type not null,
  title text not null,
  description text null,
  required boolean not null default false,
  sort integer not null default 0,
  max_choices integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vote_questions_max_choices_chk check (
    (question_type = 'single' and max_choices = 1) or (question_type = 'multi' and max_choices >= 1)
  )
);

create index if not exists vote_questions_vote_id_idx on public.vote_questions(vote_id);
create index if not exists vote_questions_question_type_idx on public.vote_questions(question_type);
create index if not exists vote_questions_sort_idx on public.vote_questions(sort);

do $$ begin
  create trigger vote_questions_set_updated_at before update on public.vote_questions
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 候选项
create table if not exists public.vote_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.vote_questions(id) on delete cascade,
  label text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists vote_question_options_question_id_idx on public.vote_question_options(question_id);
create index if not exists vote_question_options_sort_idx on public.vote_question_options(sort);

-- 提交（一人一份；截止前重复提交覆盖）
create table if not exists public.vote_responses (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.votes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vote_responses_vote_user_uq on public.vote_responses(vote_id, user_id);
create index if not exists vote_responses_vote_id_idx on public.vote_responses(vote_id);
create index if not exists vote_responses_user_id_idx on public.vote_responses(user_id);
create index if not exists vote_responses_updated_at_idx on public.vote_responses(updated_at);

do $$ begin
  create trigger vote_responses_set_updated_at before update on public.vote_responses
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 答案明细（value=jsonb：optionId/optionIds）
create table if not exists public.vote_response_items (
  response_id uuid not null references public.vote_responses(id) on delete cascade,
  question_id uuid not null references public.vote_questions(id) on delete restrict,
  value jsonb not null,
  created_at timestamptz not null default now(),
  primary key (response_id, question_id)
);

create index if not exists vote_response_items_question_id_idx on public.vote_response_items(question_id);

-- 权限字典：投票（module=vote）
insert into public.permissions (code, description)
values
  ('campus:vote:*', '投票（全量）'),
  ('campus:vote:list', '投票列表/查询（管理端）'),
  ('campus:vote:read', '投票详情/结果查看（管理端）'),
  ('campus:vote:create', '创建投票（草稿）'),
  ('campus:vote:update', '编辑投票（草稿）'),
  ('campus:vote:publish', '发布投票'),
  ('campus:vote:close', '关闭投票'),
  ('campus:vote:extend', '延期投票（修改结束时间，可重新开放）'),
  ('campus:vote:pin', '投票置顶/取消置顶'),
  ('campus:vote:archive', '归档投票')
on conflict (code) do nothing;

-- 角色-权限：staff（不含全量通配）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'campus:vote:list',
  'campus:vote:read',
  'campus:vote:create',
  'campus:vote:update',
  'campus:vote:publish',
  'campus:vote:close',
  'campus:vote:extend',
  'campus:vote:pin',
  'campus:vote:archive'
)
where r.code = 'staff'
on conflict do nothing;

-- 角色-权限：admin / super_admin（投票模块全量）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('campus:vote:*')
where r.code in ('admin', 'super_admin')
on conflict do nothing;

-- RLS：新增表启用（默认不开放直连；策略在实现阶段补齐）
alter table public.votes enable row level security;
alter table public.vote_scopes enable row level security;
alter table public.vote_questions enable row level security;
alter table public.vote_question_options enable row level security;
alter table public.vote_responses enable row level security;
alter table public.vote_response_items enable row level security;

