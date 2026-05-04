-- 数据库课程设计增强（第三批）：
-- 功能房预约的状态字段一致性继续下沉到数据库层。
-- 目标：让 reviewed_* / cancelled_* / reject_reason 与 status 的组合可解释、可防守。
--
-- 【0基础速读】
-- status 只是“当前状态”，但数据库还要知道这个状态是否有配套证据：
-- - approved：必须知道谁审核、什么时候审核
-- - rejected：必须知道谁审核、什么时候审核、为什么驳回
-- - cancelled：必须知道谁取消、什么时候取消
--
-- 这份迁移就是把这些规则变成数据库 CHECK 约束。

-- 先做“不会改变业务语义”的安全清理，避免历史脏数据阻塞新约束落地。
-- 例如 pending 本来就不应该有审核人/审核时间，如果历史数据有，就清空。
update public.facility_reservations
set reviewed_by = null,
    reviewed_at = null
where status = 'pending'
  and (reviewed_by is not null or reviewed_at is not null);

-- 非 rejected 状态不应该有驳回原因。
update public.facility_reservations
set reject_reason = null
where status <> 'rejected'
  and reject_reason is not null;

-- 非 cancelled 状态不应该有取消人/取消时间/取消原因。
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
    -- 待审核：不能有审核、驳回、取消字段。
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
    -- 已通过：必须有审核人和审核时间，不能有驳回或取消字段。
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
    -- 已驳回：必须有审核人、审核时间、驳回原因。
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
    -- 已取消：必须有取消人和取消时间。
    -- 如果这条预约曾经被审核过，审核人和审核时间可以保留，但必须成对出现。
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
