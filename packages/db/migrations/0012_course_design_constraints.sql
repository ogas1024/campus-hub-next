-- 数据库课程设计增强：
-- 1) 功能房预约：把时间冲突与参与人一致性下沉到数据库层
-- 2) 课程资源：把 major_id 的受控冗余与状态一致性下沉到数据库层

-- PostgreSQL 原生并发控制：同一房间的有效预约时间段不可重叠
create extension if not exists btree_gist with schema public;

do $$ begin
  alter table public.facility_reservations
    add constraint facility_reservations_room_active_time_excl
    exclude using gist (
      room_id with =,
      tstzrange(start_at, end_at, '[)') with &&
    )
    where (status in ('pending', 'approved'));
exception
  when duplicate_object then null;
end $$;

create or replace function public.facility_validate_reservation_participants()
returns trigger
language plpgsql
as $$
declare
  v_reservation_id uuid;
  v_applicant_id uuid;
  v_participant_count integer;
  v_applicant_marked_count integer;
  v_applicant_match_count integer;
begin
  if tg_table_name = 'facility_reservation_participants' then
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

  if v_reservation_id is null then
    return null;
  end if;

  select r.applicant_id
    into v_applicant_id
  from public.facility_reservations r
  where r.id = v_reservation_id;

  -- 预约已删除时无需继续校验。
  if v_applicant_id is null then
    return null;
  end if;

  select
    count(*)::integer,
    (count(*) filter (where p.is_applicant))::integer,
    (count(*) filter (where p.is_applicant and p.user_id = v_applicant_id))::integer
    into v_participant_count, v_applicant_marked_count, v_applicant_match_count
  from public.facility_reservation_participants p
  where p.reservation_id = v_reservation_id;

  if v_participant_count < 3 then
    raise exception using
      errcode = '23514',
      message = 'facility reservation participants must be at least 3',
      constraint = 'facility_reservation_participants_min_count_chk';
  end if;

  if v_applicant_marked_count <> 1 then
    raise exception using
      errcode = '23514',
      message = 'facility reservation must have exactly one applicant participant',
      constraint = 'facility_reservation_participants_applicant_count_chk';
  end if;

  if v_applicant_match_count <> 1 then
    raise exception using
      errcode = '23514',
      message = 'facility reservation applicant must match applicant_id',
      constraint = 'facility_reservation_participants_applicant_match_chk';
  end if;

  return null;
end;
$$;

do $$ begin
  create constraint trigger facility_reservations_participant_consistency_trg
  after insert or update of applicant_id on public.facility_reservations
  deferrable initially deferred
  for each row execute function public.facility_validate_reservation_participants();
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create constraint trigger facility_reservation_participants_consistency_trg
  after insert or update or delete on public.facility_reservation_participants
  deferrable initially deferred
  for each row execute function public.facility_validate_reservation_participants();
exception
  when duplicate_object then null;
end $$;

-- 课程资源的 major_id 属于“可解释的受控冗余”：
-- 先把历史数据回填为与源关系一致，再加复合键/复合外键约束。
update public.course_resources cr
set major_id = c.major_id
from public.courses c
where cr.course_id = c.id
  and cr.major_id is distinct from c.major_id;

update public.course_resource_score_events se
set major_id = cr.major_id
from public.course_resources cr
where se.resource_id = cr.id
  and se.major_id is distinct from cr.major_id;

do $$ begin
  alter table public.courses
    add constraint courses_id_major_id_uq unique (id, major_id);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.course_resources
    add constraint course_resources_id_major_id_uq unique (id, major_id);
exception
  when duplicate_object then null;
end $$;

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

do $$ begin
  alter table public.course_resource_bests
    add constraint course_resource_bests_best_by_fk
    foreign key (best_by)
    references auth.users(id)
    on delete restrict;
exception
  when duplicate_object then null;
end $$;

alter table if exists public.course_resources
drop constraint if exists course_resources_status_consistency_chk;

alter table if exists public.course_resources
add constraint course_resources_status_consistency_chk check (
  (
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
    status = 'rejected'
    and submitted_at is not null
    and reviewed_at is not null
    and review_comment is not null
    and published_at is null
    and unpublished_at is null
  )
  or
  (
    status = 'published'
    and submitted_at is not null
    and reviewed_at is not null
    and published_at is not null
    and unpublished_at is null
  )
  or
  (
    status = 'unpublished'
    and submitted_at is not null
    and reviewed_at is not null
    and published_at is not null
    and unpublished_at is not null
  )
);
