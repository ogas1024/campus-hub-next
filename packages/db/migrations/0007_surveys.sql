-- 问卷（创建/发布/关闭/提交/统计/导出/AI 总结）
-- 约定：
-- - 仅新增结构与可逆默认数据（权限/授权）；不执行破坏性数据操作
-- - 填写必须登录；匿名答卷仅影响“管理端展示/导出/AI 总结”是否暴露身份
-- - Console 侧访问控制由 BFF 实现；RLS 默认开启但不下发策略（避免直连）

-- 枚举：问卷状态
do $$ begin
  create type public.survey_status as enum ('draft', 'published', 'closed');
exception
  when duplicate_object then null;
end $$;

-- 枚举：问卷可见范围类型
do $$ begin
  create type public.survey_scope_type as enum ('role', 'department', 'position');
exception
  when duplicate_object then null;
end $$;

-- 枚举：题型
do $$ begin
  create type public.survey_question_type as enum ('text', 'single', 'multi', 'rating');
exception
  when duplicate_object then null;
end $$;

-- 问卷（头）
create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description_md text not null default '',
  status public.survey_status not null default 'draft',

  start_at timestamptz not null,
  end_at timestamptz not null,

  anonymous_responses boolean not null default false,
  visible_all boolean not null default true,

  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid null references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint surveys_time_chk check (end_at > start_at)
);

create index if not exists surveys_status_idx on public.surveys(status);
create index if not exists surveys_time_idx on public.surveys(start_at, end_at);
create index if not exists surveys_created_by_idx on public.surveys(created_by);

do $$ begin
  create trigger surveys_set_updated_at before update on public.surveys
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 可见范围（沿用公告口径：visible_all OR scopes 命中）
create table if not exists public.survey_scopes (
  survey_id uuid not null references public.surveys(id) on delete cascade,
  scope_type public.survey_scope_type not null,
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (survey_id, scope_type, ref_id)
);

create index if not exists survey_scopes_survey_id_idx on public.survey_scopes(survey_id);

-- 分节（Google Forms 风格）
create table if not exists public.survey_sections (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  title text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists survey_sections_survey_id_idx on public.survey_sections(survey_id);
create index if not exists survey_sections_sort_idx on public.survey_sections(sort);

do $$ begin
  create trigger survey_sections_set_updated_at before update on public.survey_sections
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 题目
create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  section_id uuid not null references public.survey_sections(id) on delete cascade,
  question_type public.survey_question_type not null,
  title text not null,
  description text null,
  required boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists survey_questions_survey_id_idx on public.survey_questions(survey_id);
create index if not exists survey_questions_section_id_idx on public.survey_questions(section_id);
create index if not exists survey_questions_question_type_idx on public.survey_questions(question_type);
create index if not exists survey_questions_sort_idx on public.survey_questions(sort);

do $$ begin
  create trigger survey_questions_set_updated_at before update on public.survey_questions
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 选项（仅 single/multi）
create table if not exists public.survey_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  label text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists survey_question_options_question_id_idx on public.survey_question_options(question_id);
create index if not exists survey_question_options_sort_idx on public.survey_question_options(sort);

-- 答卷（一人一份；截止前重复提交覆盖）
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists survey_responses_survey_user_uq on public.survey_responses(survey_id, user_id);
create index if not exists survey_responses_survey_id_idx on public.survey_responses(survey_id);
create index if not exists survey_responses_user_id_idx on public.survey_responses(user_id);
create index if not exists survey_responses_updated_at_idx on public.survey_responses(updated_at);

do $$ begin
  create trigger survey_responses_set_updated_at before update on public.survey_responses
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 答案明细（value=jsonb：text/optionId/optionIds/value）
create table if not exists public.survey_response_items (
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id) on delete restrict,
  value jsonb not null,
  created_at timestamptz not null default now(),
  primary key (response_id, question_id)
);

create index if not exists survey_response_items_question_id_idx on public.survey_response_items(question_id);

-- 权限字典：问卷（module=survey）
insert into public.permissions (code, description)
values
  ('campus:survey:*', '问卷（全量）'),
  ('campus:survey:list', '问卷列表/查询（管理端）'),
  ('campus:survey:read', '问卷详情查看（管理端）'),
  ('campus:survey:create', '创建问卷（草稿）'),
  ('campus:survey:update', '编辑问卷（草稿）'),
  ('campus:survey:publish', '发布问卷'),
  ('campus:survey:close', '关闭问卷'),
  ('campus:survey:export', '导出答卷（CSV）'),
  ('campus:survey:ai_summary', 'AI 总结问卷结果（Markdown）'),
  ('campus:survey:delete', '删除问卷（软删）')
on conflict (code) do nothing;

-- 角色-权限：staff（创建/发布/查看结果/导出/AI 总结；不含删除）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'campus:survey:list',
  'campus:survey:read',
  'campus:survey:create',
  'campus:survey:update',
  'campus:survey:publish',
  'campus:survey:close',
  'campus:survey:export',
  'campus:survey:ai_summary'
)
where r.code = 'staff'
on conflict do nothing;

-- 角色-权限：admin / super_admin（问卷模块全量）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('campus:survey:*')
where r.code in ('admin', 'super_admin')
on conflict do nothing;

-- RLS：新增表启用（默认不开放直连；策略在实现阶段补齐）
alter table public.surveys enable row level security;
alter table public.survey_scopes enable row level security;
alter table public.survey_sections enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_question_options enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_response_items enable row level security;

