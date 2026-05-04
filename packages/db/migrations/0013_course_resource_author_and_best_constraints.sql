-- 数据库课程设计增强（第二批）：
-- 1) 积分事件的归属用户必须等于资源作者
-- 2) 最佳推荐只能作用于已发布资源
--
-- 【0基础速读】
-- 这份迁移解决两个老师容易追问的问题：
-- - 如果有人手工给非作者加积分怎么办？
-- - 如果有人把未发布资源设为最佳怎么办？
--
-- 答案：
-- - 用复合外键保证积分用户就是资源作者
-- - 用触发器保证最佳推荐只能作用于 published 资源

-- course_resource_score_events.user_id 是为排行榜/统计保留的受控冗余，
-- 先把历史积分事件的 user_id 回填成资源作者 created_by，
-- 否则后面加复合外键时，旧脏数据会导致迁移失败。
update public.course_resource_score_events se
set user_id = cr.created_by
from public.course_resources cr
where se.resource_id = cr.id
  and se.user_id is distinct from cr.created_by;

-- 外键只能引用主键或唯一键。
-- 所以先让 course_resources(id, created_by) 成为唯一组合，
-- 后面 score_events(resource_id, user_id) 才能引用它。
do $$ begin
  alter table public.course_resources
    add constraint course_resources_id_created_by_uq unique (id, created_by);
exception
  when duplicate_object then null;
end $$;

-- 复合外键：积分事件的 (resource_id, user_id)
-- 必须能在资源表的 (id, created_by) 中找到。
-- 换句话说：积分必须加给资源作者，不能加给别人。
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

-- “最佳推荐”是资源发布态上的派生标签。
-- 如果历史数据里有非 published 资源的最佳记录，先删除，否则后面触发器规则会不一致。
delete from public.course_resource_bests b
using public.course_resources cr
where b.resource_id = cr.id
  and cr.status <> 'published';

-- 触发器函数：插入/更新最佳推荐前，先查资源状态。
-- 如果资源不是 published，就拒绝。
-- 这类规则需要查另一张表，普通 CHECK 做不了。
create or replace function public.course_resource_best_requires_published()
returns trigger
language plpgsql
as $$
declare
  v_status public.course_resource_status;
begin
  -- 查当前要设为最佳的资源状态。
  select cr.status
    into v_status
  from public.course_resources cr
  where cr.id = new.resource_id;

  -- 资源不存在时交给既有外键报错；这里只负责发布态约束。
  if v_status is null then
    return new;
  end if;

  -- 只有 published 资源允许进入 course_resource_bests。
  if v_status <> 'published' then
    raise exception using
      errcode = '23514',
      message = 'course resource best requires published status',
      constraint = 'course_resource_bests_resource_published_chk';
  end if;

  return new;
end;
$$;

-- 绑定触发器：每次 insert/update course_resource_bests 前执行发布态检查。
do $$ begin
  create trigger course_resource_bests_require_published_trg
  before insert or update on public.course_resource_bests
  for each row execute function public.course_resource_best_requires_published();
exception
  when duplicate_object then null;
end $$;

-- 触发器函数：资源一旦离开 published 状态，就自动删除它的最佳推荐记录。
-- 这样不会出现“未发布资源仍然是最佳”的脏数据。
create or replace function public.course_resource_drop_best_when_not_published()
returns trigger
language plpgsql
as $$
begin
  -- new 表示更新后的资源行。
  if new.status <> 'published' then
    delete from public.course_resource_bests
    where resource_id = new.id;
  end if;

  return new;
end;
$$;

-- 绑定触发器：只有 status 发生变化时才执行。
do $$ begin
  create trigger course_resources_drop_best_on_status_change_trg
  after update of status on public.course_resources
  for each row
  when (old.status is distinct from new.status)
  execute function public.course_resource_drop_best_when_not_published();
exception
  when duplicate_object then null;
end $$;
