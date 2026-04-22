-- 数据库课程设计增强（第三批）：
-- 功能房预约的状态字段一致性继续下沉到数据库层。
-- 目标：让 reviewed_* / cancelled_* / reject_reason 与 status 的组合可解释、可防守。

-- 先做“不会改变业务语义”的安全清理，避免历史脏数据阻塞新约束落地。
update public.facility_reservations
set reviewed_by = null,
    reviewed_at = null
where status = 'pending'
  and (reviewed_by is not null or reviewed_at is not null);

update public.facility_reservations
set reject_reason = null
where status <> 'rejected'
  and reject_reason is not null;

update public.facility_reservations
set cancelled_by = null,
    cancelled_at = null,
    cancel_reason = null
where status <> 'cancelled'
  and (cancelled_by is not null or cancelled_at is not null or cancel_reason is not null);

alter table if exists public.facility_reservations
drop constraint if exists facility_reservations_review_chk;

alter table if exists public.facility_reservations
drop constraint if exists facility_reservations_status_consistency_chk;

-- 说明：
-- 1) pending：尚未审核，也未取消
-- 2) approved：必须留下审核人/审核时间
-- 3) rejected：必须留下审核人/审核时间/驳回原因
-- 4) cancelled：必须留下取消人/取消时间；若曾先通过审核，可保留审核痕迹
alter table if exists public.facility_reservations
add constraint facility_reservations_status_consistency_chk check (
  (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and reject_reason is null
    and cancelled_by is null
    and cancelled_at is null
    and cancel_reason is null
  )
  or
  (
    status = 'approved'
    and reviewed_by is not null
    and reviewed_at is not null
    and reject_reason is null
    and cancelled_by is null
    and cancelled_at is null
    and cancel_reason is null
  )
  or
  (
    status = 'rejected'
    and reviewed_by is not null
    and reviewed_at is not null
    and reject_reason is not null
    and cancelled_by is null
    and cancelled_at is null
    and cancel_reason is null
  )
  or
  (
    status = 'cancelled'
    and cancelled_by is not null
    and cancelled_at is not null
    and reject_reason is null
    and (
      (reviewed_by is null and reviewed_at is null)
      or
      (reviewed_by is not null and reviewed_at is not null)
    )
  )
);
