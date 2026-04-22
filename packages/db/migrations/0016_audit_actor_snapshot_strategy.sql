-- 数据库课程设计增强（第五批）：
-- 1) 审计日志继续保持 append-only，不对 actor_user_id 建立到 auth.users 的物理外键
-- 2) 增加 actor_name 快照，避免用户资料变更后丢失历史语义
-- 3) 对 actor_roles 的快照结构增加最低限度检查，使审计记录更可解释

alter table if exists public.audit_logs
add column if not exists actor_name text null;

update public.audit_logs l
set actor_name = p.name
from public.profiles p
where l.actor_name is null
  and p.id = l.actor_user_id;

alter table if exists public.audit_logs
drop constraint if exists audit_logs_actor_roles_object_chk;

alter table if exists public.audit_logs
add constraint audit_logs_actor_roles_object_chk check (
  actor_roles is null
  or case
    when jsonb_typeof(actor_roles) <> 'object' then false
    when not (actor_roles ? 'roleCodes') then true
    else jsonb_typeof(actor_roles -> 'roleCodes') = 'array'
  end
);

comment on table public.audit_logs is
  '管理端审计日志；append-only。actor_user_id 为审计主体标识，故意不建立到 auth.users 的物理外键，避免用户删除或脱敏后破坏历史审计事实。';

comment on column public.audit_logs.actor_user_id is
  '审计主体标识（弱引用）。为保留历史事实，不建立到 auth.users 的物理外键。';

comment on column public.audit_logs.actor_name is
  '操作者姓名快照，保留事件发生时的可读身份语义。';

comment on column public.audit_logs.actor_email is
  '操作者邮箱快照，便于检索；不依赖当前 auth.users 中的最新值。';

comment on column public.audit_logs.actor_roles is
  '操作者角色快照，建议结构为 {\"roleCodes\": [...]}，用于保留事件发生时的权限语义。';

comment on column public.audit_logs.diff is
  '变更差异快照；建议仅记录白名单字段，避免审计扩散敏感信息。';
