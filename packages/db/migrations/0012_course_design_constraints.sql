-- 数据库课程设计增强（答辩重点）：
-- 1) 功能房预约：把“时间冲突”和“参与人一致性”下沉到数据库层。
-- 2) 课程资源：把 major_id 的受控冗余、积分归属、状态一致性下沉到数据库层。
--
-- 0基础理解：
-- - 这份迁移不是单纯建表，而是给已经存在的表补“硬规则”。
-- - 硬规则的意思是：即使绕过服务层直接写数据库，数据库也会拒绝非法数据。
-- - 老师最可能追问：并发预约怎么防冲突？参与人至少 3 人怎么保证？
--   课程资源为什么同时存 course_id 和 major_id？如何保证不写错？

-- 【功能房 1：时间冲突排斥约束】
-- btree_gist 是 PostgreSQL 扩展，让 GiST 索引既能比较 uuid 相等，
-- 又能比较时间范围是否重叠。
-- 没有它，下面的 room_id with = 和 tstzrange with && 很难放进同一个排斥约束。
create extension if not exists btree_gist with schema public;

do $$ begin
  -- 给 facility_reservations 表增加排斥约束。
  -- 排斥约束可以理解成“这些条件不能同时成立”。
  alter table public.facility_reservations
    add constraint facility_reservations_room_active_time_excl
    exclude using gist (
      -- 同一个房间：room_id 必须相等时才比较冲突。
      room_id with =,
      -- tstzrange(start_at, end_at, '[)') 把开始/结束时间变成一个时间区间。
      -- && 表示两个时间区间有重叠。
      -- '[)' 表示包含开始时间，不包含结束时间：
      -- 10:00-11:00 和 11:00-12:00 可以连续预约，不算重叠。
      tstzrange(start_at, end_at, '[)') with &&
    )
    -- 只有 pending/approved 会占用或预占房间；rejected/cancelled 不参与冲突。
    where (status in ('pending', 'approved'));
exception
  -- 如果约束已经存在，就忽略，保证迁移重复执行时不报错。
  when duplicate_object then null;
end $$;

-- 【功能房 2：参与人一致性校验函数】
-- 这个函数会被后面的约束触发器调用。
-- 它检查三件事：
-- 1. 每条预约至少 3 个参与人
-- 2. 每条预约恰好 1 个 is_applicant=true 的参与人
-- 3. 这个申请人参与人的 user_id 必须等于预约主表里的 applicant_id
--
-- 为什么不用 CHECK？
-- CHECK 只能检查当前一行；这里要统计同一预约的多行参与人，还要查预约主表，所以必须用触发器函数。
create or replace function public.facility_validate_reservation_participants()
returns trigger
language plpgsql
as $$
declare
  -- 当前需要校验的预约 id。
  v_reservation_id uuid;
  -- 预约主表里的申请人 id。
  v_applicant_id uuid;
  -- 参与人总数。
  v_participant_count integer;
  -- is_applicant=true 的参与人数量。
  v_applicant_marked_count integer;
  -- is_applicant=true 且 user_id 等于 applicant_id 的数量。
  v_applicant_match_count integer;
begin
  -- 触发器可能来自两张表：
  -- 1. facility_reservation_participants：参与人表变化时
  -- 2. facility_reservations：预约主表 applicant_id 变化时
  -- 所以这里先判断当前触发器是哪张表触发的。
  if tg_table_name = 'facility_reservation_participants' then
    -- old/new 是触发器里的特殊变量：
    -- INSERT 时只有 new；DELETE 时只有 old；UPDATE 时 old/new 都有。
    v_reservation_id := case
      when tg_op = 'DELETE' then old.reservation_id
      when tg_op = 'INSERT' then new.reservation_id
      else coalesce(new.reservation_id, old.reservation_id)
    end;
  else
    v_reservation_id := case
      when tg_op = 'DELETE' then old.id
      when tg_op = 'INSERT' then new.id
      else coalesce(new.id, old.id)
    end;
  end if;

  -- 如果拿不到预约 id，就没有办法校验，直接结束。
  if v_reservation_id is null then
    return null;
  end if;

  -- 根据预约 id 查出主表里的 applicant_id。
  select r.applicant_id
    into v_applicant_id
  from public.facility_reservations r
  where r.id = v_reservation_id;

  -- 预约已删除时无需继续校验。
  if v_applicant_id is null then
    return null;
  end if;

  -- 统计当前预约下的参与人情况。
  select
    count(*)::integer,
    (count(*) filter (where p.is_applicant))::integer,
    (count(*) filter (where p.is_applicant and p.user_id = v_applicant_id))::integer
    into v_participant_count, v_applicant_marked_count, v_applicant_match_count
  from public.facility_reservation_participants p
  where p.reservation_id = v_reservation_id;

  -- 规则 1：至少 3 人。
  if v_participant_count < 3 then
    raise exception using
      errcode = '23514',
      message = 'facility reservation participants must be at least 3',
      constraint = 'facility_reservation_participants_min_count_chk';
  end if;

  -- 规则 2：恰好 1 个申请人标记。
  if v_applicant_marked_count <> 1 then
    raise exception using
      errcode = '23514',
      message = 'facility reservation must have exactly one applicant participant',
      constraint = 'facility_reservation_participants_applicant_count_chk';
  end if;

  -- 规则 3：申请人标记必须对应主表 applicant_id。
  if v_applicant_match_count <> 1 then
    raise exception using
      errcode = '23514',
      message = 'facility reservation applicant must match applicant_id',
      constraint = 'facility_reservation_participants_applicant_match_chk';
  end if;

  return null;
end;
$$;

-- 【触发器 1：预约主表变化时校验参与人】
-- deferrable initially deferred = 延迟到事务提交时再检查。
-- 为什么延迟？
-- 创建预约时通常先插主表，再插参与人；中间状态暂时不满足“至少 3 人”。
-- 如果立即检查，会误伤正常写入流程。
do $$ begin
  create constraint trigger facility_reservations_participant_consistency_trg
  after insert or update of applicant_id on public.facility_reservations
  deferrable initially deferred
  for each row execute function public.facility_validate_reservation_participants();
exception
  when duplicate_object then null;
end $$;

-- 【触发器 2：参与人表变化时校验参与人】
-- 插入、更新、删除参与人后，都要在事务提交时检查最终参与人集合是否合法。
do $$ begin
  create constraint trigger facility_reservation_participants_consistency_trg
  after insert or update or delete on public.facility_reservation_participants
  deferrable initially deferred
  for each row execute function public.facility_validate_reservation_participants();
exception
  when duplicate_object then null;
end $$;

-- 【课程资源 1：major_id 受控冗余】
-- 背景：
-- course_resources 里同时保存 course_id 和 major_id。
-- 严格范式角度看，course_id 可以通过 courses 表推出 major_id，所以 major_id 有冗余风险。
-- 但项目保留 major_id，是为了按专业过滤、统计、做数据范围控制更快。
--
-- 答辩关键：
-- 这不是随便冗余，而是“受控冗余”：
-- 数据库用复合外键保证 course_resources.major_id 必须等于课程真实所属专业。
--
-- 加约束前先把旧数据修正成一致状态，否则加外键会失败。
update public.course_resources cr
set major_id = c.major_id
from public.courses c
where cr.course_id = c.id
  and cr.major_id is distinct from c.major_id;

-- 积分事件表里的 major_id 也同理，先回填成资源所属专业。
update public.course_resource_score_events se
set major_id = cr.major_id
from public.course_resources cr
where se.resource_id = cr.id
  and se.major_id is distinct from cr.major_id;

-- 为复合外键准备“被引用的一组唯一值”。
-- 外键只能引用主键或唯一键，所以先给 courses(id, major_id) 加唯一约束。
do $$ begin
  alter table public.courses
    add constraint courses_id_major_id_uq unique (id, major_id);
exception
  when duplicate_object then null;
end $$;

-- 同理，积分事件要引用 course_resources(id, major_id)，所以资源表也要有这个唯一组合。
do $$ begin
  alter table public.course_resources
    add constraint course_resources_id_major_id_uq unique (id, major_id);
exception
  when duplicate_object then null;
end $$;

-- 真正锁定“资源课程和专业必须一致”的复合外键。
-- 意思：course_resources 的 (course_id, major_id) 必须能在 courses 的 (id, major_id) 中找到。
-- 如果 course_id 属于 A 专业，却把 major_id 写成 B 专业，数据库会拒绝。
do $$ begin
  alter table public.course_resources
    add constraint course_resources_course_major_fk
    foreign key (course_id, major_id)
    references public.courses(id, major_id)
    on update cascade
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

-- 锁定“积分事件专业必须等于资源专业”。
-- 意思：score_events 的 (resource_id, major_id) 必须匹配资源表里的 (id, major_id)。
do $$ begin
  alter table public.course_resource_score_events
    add constraint course_resource_score_events_resource_major_fk
    foreign key (resource_id, major_id)
    references public.course_resources(id, major_id)
    on update cascade
    on delete cascade;
exception
  when duplicate_object then null;
end $$;

-- 最佳推荐记录里的 best_by 必须是真实用户。
-- 之前 best_by 只是 uuid 字段，这里补上物理外键。
do $$ begin
  alter table public.course_resource_bests
    add constraint course_resource_bests_best_by_fk
    foreign key (best_by)
    references auth.users(id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

-- 先删除旧的状态一致性约束，再添加新版本。
-- 这样迁移可重复执行，也方便约束升级。
alter table if exists public.course_resources
drop constraint if exists course_resources_status_consistency_chk;

-- 【课程资源 2：资源状态和时间字段一致性】
-- 这段 CHECK 的作用：
-- 让 status 不只是一个孤立字符串，而必须和 submitted/reviewed/published/unpublished 等时间字段匹配。
-- 例如：
-- - draft：还没提交，所以 submitted_at/reviewed_at/published_at 都必须为空
-- - pending：已提交但未审核，所以 submitted_at 非空，reviewed_at 为空
-- - published：已审核已发布，所以 reviewed_at/published_at 非空
-- - unpublished：曾经发布，后来下架，所以 published_at/unpublished_at 都非空
alter table if exists public.course_resources
add constraint course_resources_status_consistency_chk check (
  (
    -- 草稿：什么流程时间都还没有。
    status = 'draft'
    and submitted_at is null
    and reviewed_by is null
    and reviewed_at is null
    and review_comment is null
    and published_at is null
    and unpublished_at is null
  )
  or
  (
    -- 待审核：已经提交，但还没有审核结果。
    status = 'pending'
    and submitted_at is not null
    and reviewed_by is null
    and reviewed_at is null
    and review_comment is null
    and published_at is null
    and unpublished_at is null
  )
  or
  (
    -- 已驳回：已经提交、已经审核，并且必须有审核意见。
    status = 'rejected'
    and submitted_at is not null
    and reviewed_at is not null
    and review_comment is not null
    and published_at is null
    and unpublished_at is null
  )
  or
  (
    -- 已发布：已经提交、审核、发布，且没有下架时间。
    status = 'published'
    and submitted_at is not null
    and reviewed_at is not null
    and published_at is not null
    and unpublished_at is null
  )
  or
  (
    -- 已下架：必须曾经发布过，并且有下架时间。
    status = 'unpublished'
    and submitted_at is not null
    and reviewed_at is not null
    and published_at is not null
    and unpublished_at is not null
  )
);
