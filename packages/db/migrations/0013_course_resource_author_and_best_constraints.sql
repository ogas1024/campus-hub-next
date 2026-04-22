-- 数据库课程设计增强（第二批）：
-- 1) 积分事件的归属用户必须等于资源作者
-- 2) 最佳推荐只能作用于已发布资源

-- course_resource_score_events.user_id 是为排行榜/统计保留的受控冗余，
-- 先回填历史数据，再用复合外键把它锁定到 course_resources(created_by)。
update public.course_resource_score_events se
set user_id = cr.created_by
from public.course_resources cr
where se.resource_id = cr.id
  and se.user_id is distinct from cr.created_by;

do $$ begin
  alter table public.course_resources
    add constraint course_resources_id_created_by_uq unique (id, created_by);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.course_resource_score_events
    add constraint course_resource_score_events_resource_user_fk
    foreign key (resource_id, user_id)
    references public.course_resources(id, created_by)
    on update cascade
    on delete cascade;
exception
  when duplicate_object then null;
end $$;

-- “最佳推荐”是资源发布态上的派生标签；历史上若残留到非 published 资源，先清理。
delete from public.course_resource_bests b
using public.course_resources cr
where b.resource_id = cr.id
  and cr.status <> 'published';

create or replace function public.course_resource_best_requires_published()
returns trigger
language plpgsql
as $$
declare
  v_status public.course_resource_status;
begin
  select cr.status
    into v_status
  from public.course_resources cr
  where cr.id = new.resource_id;

  -- 资源不存在时交给既有外键报错；这里只负责发布态约束。
  if v_status is null then
    return new;
  end if;

  if v_status <> 'published' then
    raise exception using
      errcode = '23514',
      message = 'course resource best requires published status',
      constraint = 'course_resource_bests_resource_published_chk';
  end if;

  return new;
end;
$$;

do $$ begin
  create trigger course_resource_bests_require_published_trg
  before insert or update on public.course_resource_bests
  for each row execute function public.course_resource_best_requires_published();
exception
  when duplicate_object then null;
end $$;

create or replace function public.course_resource_drop_best_when_not_published()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'published' then
    delete from public.course_resource_bests
    where resource_id = new.id;
  end if;

  return new;
end;
$$;

do $$ begin
  create trigger course_resources_drop_best_on_status_change_trg
  after update of status on public.course_resources
  for each row
  when (old.status is distinct from new.status)
  execute function public.course_resource_drop_best_when_not_published();
exception
  when duplicate_object then null;
end $$;
