import "server-only";

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { hasPerm } from "@/lib/auth/permissions";
import { badRequest, conflict, forbidden, notFound, HttpError } from "@/lib/http/errors";
import type { RequestContext } from "@/lib/http/route";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import { writeAuditLog } from "@/lib/modules/audit/audit.service";
import { parseDurationMs, parseIsoDateTime, requireUuid } from "@/lib/modules/facilities/facilities.utils";
import {
  appConfig,
  authUsers,
  facilityBans,
  facilityBuildings,
  facilityReservationParticipants,
  facilityReservations,
  facilityRooms,
  profiles,
} from "@campus-hub/db";

type ReservationStatus = "pending" | "approved" | "rejected" | "cancelled";
type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function toErrorCode(err: unknown) {
  return err instanceof HttpError ? err.code : "INTERNAL_ERROR";
}

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return null;
}

async function getConfigBool(key: string, defaultValue: boolean) {
  const rows = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, key)).limit(1);
  return coerceBoolean(rows[0]?.value) ?? defaultValue;
}

async function getConfigNumber(key: string, defaultValue: number) {
  const rows = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, key)).limit(1);
  const raw = rows[0]?.value;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return defaultValue;
}

function ensureDays(value: number) {
  if (value !== 7 && value !== 30) throw badRequest("days 仅支持 7 或 30");
  return value;
}

async function assertActiveUsersExist(userIds: string[]) {
  if (userIds.length === 0) return;
  const ids = [...new Set(userIds)];

  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .innerJoin(authUsers, eq(authUsers.id, profiles.id))
    .where(
      and(
        inArray(profiles.id, ids),
        eq(profiles.status, "active"),
        isNull(authUsers.deletedAt),
        or(isNull(authUsers.bannedUntil), sql`${authUsers.bannedUntil} <= now()`)!,
      ),
    );

  if (rows.length !== ids.length) {
    const found = new Set(rows.map((r) => r.id));
    const missing = ids.filter((id) => !found.has(id));
    throw badRequest("存在不存在或不可用的参与人", { missing });
  }
}

async function assertNotBanned(userId: string) {
  const rows = await db
    .select({ id: facilityBans.id, expiresAt: facilityBans.expiresAt })
    .from(facilityBans)
    .where(and(eq(facilityBans.userId, userId), isNull(facilityBans.revokedAt)))
    .orderBy(desc(facilityBans.createdAt), desc(facilityBans.id))
    .limit(1);

  const row = rows[0];
  if (!row) return;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return;
  throw forbidden("你已被功能房预约模块封禁，无法提交预约");
}

export async function searchActiveUsers(params: { q: string; limit: number }) {
  const q = params.q.trim();
  if (q.length < 1) throw badRequest("q 必填");
  const limit = Math.min(20, Math.max(1, params.limit));

  const pattern = `%${q}%`;
  const rows = await db
    .select({ id: profiles.id, name: profiles.name, studentId: profiles.studentId })
    .from(profiles)
    .innerJoin(authUsers, eq(authUsers.id, profiles.id))
    .where(
      and(
        eq(profiles.status, "active"),
        isNull(authUsers.deletedAt),
        or(isNull(authUsers.bannedUntil), sql`${authUsers.bannedUntil} <= now()`)!,
        or(sql`${profiles.name} ilike ${pattern}`, sql`${profiles.studentId} ilike ${pattern}`, sql`${authUsers.email} ilike ${pattern}`)!,
      ),
    )
    .orderBy(asc(profiles.name), asc(profiles.studentId))
    .limit(limit);

  return { items: rows };
}

export async function listPortalBuildings() {
  const rows = await db
    .select({
      id: facilityBuildings.id,
      name: facilityBuildings.name,
      enabled: facilityBuildings.enabled,
      sort: facilityBuildings.sort,
      remark: facilityBuildings.remark,
    })
    .from(facilityBuildings)
    .where(and(eq(facilityBuildings.enabled, true), isNull(facilityBuildings.deletedAt)))
    .orderBy(asc(facilityBuildings.sort), asc(facilityBuildings.name));
  return rows;
}

export async function listPortalFloors(buildingId: string) {
  requireUuid(buildingId, "buildingId");

  const b = await db
    .select({ id: facilityBuildings.id })
    .from(facilityBuildings)
    .where(and(eq(facilityBuildings.id, buildingId), eq(facilityBuildings.enabled, true), isNull(facilityBuildings.deletedAt)))
    .limit(1);
  if (!b[0]) throw notFound("楼房不存在或不可用");

  const rows = await db
    .select({ floorNo: facilityRooms.floorNo })
    .from(facilityRooms)
    .where(and(eq(facilityRooms.buildingId, buildingId), isNull(facilityRooms.deletedAt)))
    .groupBy(facilityRooms.floorNo)
    .orderBy(desc(facilityRooms.floorNo));

  return { buildingId, floors: rows.map((r) => r.floorNo) };
}

export async function getPortalFloorOverview(params: {
  buildingId: string;
  floorNo: number;
  from: Date;
  days: number;
}) {
  requireUuid(params.buildingId, "buildingId");
  ensureDays(params.days);

  const b = await db
    .select({ id: facilityBuildings.id })
    .from(facilityBuildings)
    .where(and(eq(facilityBuildings.id, params.buildingId), eq(facilityBuildings.enabled, true), isNull(facilityBuildings.deletedAt)))
    .limit(1);
  if (!b[0]) throw notFound("楼房不存在或不可用");

  const from = params.from;
  const to = new Date(from.getTime() + params.days * 24 * 60 * 60 * 1000);

  const rooms = await db
    .select({
      id: facilityRooms.id,
      buildingId: facilityRooms.buildingId,
      floorNo: facilityRooms.floorNo,
      name: facilityRooms.name,
      capacity: facilityRooms.capacity,
      enabled: facilityRooms.enabled,
      sort: facilityRooms.sort,
      remark: facilityRooms.remark,
    })
    .from(facilityRooms)
    .where(
      and(
        eq(facilityRooms.buildingId, params.buildingId),
        eq(facilityRooms.floorNo, params.floorNo),
        isNull(facilityRooms.deletedAt),
      ),
    )
    .orderBy(asc(facilityRooms.sort), asc(facilityRooms.name));

  const roomIds = rooms.map((r) => r.id);

  const items =
    roomIds.length === 0
      ? []
      : await db
          .select({
            id: facilityReservations.id,
            roomId: facilityReservations.roomId,
            status: facilityReservations.status,
            startAt: facilityReservations.startAt,
            endAt: facilityReservations.endAt,
          })
          .from(facilityReservations)
          .where(
            and(
              inArray(facilityReservations.roomId, roomIds),
              inArray(facilityReservations.status, ["pending", "approved"]),
              sql`${facilityReservations.startAt} < ${to.toISOString()}`,
              sql`${facilityReservations.endAt} > ${from.toISOString()}`,
            ),
          )
          .orderBy(asc(facilityReservations.startAt), asc(facilityReservations.id));

  return {
    buildingId: params.buildingId,
    floorNo: params.floorNo,
    window: { from, to },
    rooms,
    items: items.map((i) => ({
      id: i.id,
      roomId: i.roomId,
      status: i.status as ReservationStatus,
      startAt: i.startAt,
      endAt: i.endAt,
    })),
  };
}

export async function getPortalRoomTimeline(params: { roomId: string; from: Date; days: number }) {
  requireUuid(params.roomId, "id");
  ensureDays(params.days);

  const from = params.from;
  const to = new Date(from.getTime() + params.days * 24 * 60 * 60 * 1000);

  const roomRows = await db
    .select({
      id: facilityRooms.id,
      buildingId: facilityRooms.buildingId,
      buildingName: facilityBuildings.name,
      floorNo: facilityRooms.floorNo,
      name: facilityRooms.name,
      capacity: facilityRooms.capacity,
      enabled: facilityRooms.enabled,
      sort: facilityRooms.sort,
      remark: facilityRooms.remark,
    })
    .from(facilityRooms)
    .innerJoin(facilityBuildings, eq(facilityBuildings.id, facilityRooms.buildingId))
    .where(
      and(
        eq(facilityRooms.id, params.roomId),
        isNull(facilityRooms.deletedAt),
        eq(facilityBuildings.enabled, true),
        isNull(facilityBuildings.deletedAt),
      ),
    )
    .limit(1);

  const room = roomRows[0];
  if (!room) throw notFound("房间不存在或不可用");

  const items = await db
    .select({
      id: facilityReservations.id,
      roomId: facilityReservations.roomId,
      status: facilityReservations.status,
      startAt: facilityReservations.startAt,
      endAt: facilityReservations.endAt,
    })
    .from(facilityReservations)
    .where(
      and(
        eq(facilityReservations.roomId, params.roomId),
        inArray(facilityReservations.status, ["pending", "approved"]),
        sql`${facilityReservations.startAt} < ${to.toISOString()}`,
        sql`${facilityReservations.endAt} > ${from.toISOString()}`,
      ),
    )
    .orderBy(asc(facilityReservations.startAt), asc(facilityReservations.id));

  return { room, window: { from, to }, items };
}

function normalizeParticipantUserIds(params: { applicantId: string; participantUserIds: string[] }) {
  const normalized = params.participantUserIds.map((id) => id.trim()).filter(Boolean);
  if (normalized.some((id) => id === params.applicantId)) {
    throw badRequest("participantUserIds 不允许包含申请人");
  }

  const unique = [...new Set([params.applicantId, ...normalized])];
  if (unique.length < 3) throw badRequest("使用人列表不少于 3 人（含申请人）");
  return unique;
}

async function lockRoomOrThrow(tx: DbTx, roomId: string) {
  const res = await tx.execute(
    sql`select ${facilityRooms.id} from ${facilityRooms}
      inner join ${facilityBuildings} on ${facilityBuildings.id} = ${facilityRooms.buildingId}
      where ${facilityRooms.id} = ${roomId}
        and ${facilityRooms.enabled} = true
        and ${facilityRooms.deletedAt} is null
        and ${facilityBuildings.enabled} = true
        and ${facilityBuildings.deletedAt} is null
      for update`,
  );
  if (res.length === 0) throw notFound("房间不存在或不可用");
}

async function assertNoTimeOverlap(params: { tx: DbTx; roomId: string; startAt: Date; endAt: Date; excludeReservationId?: string }) {
  const where = [
    eq(facilityReservations.roomId, params.roomId),
    inArray(facilityReservations.status, ["pending", "approved"]),
    sql`${facilityReservations.startAt} < ${params.endAt.toISOString()}`,
    sql`${facilityReservations.endAt} > ${params.startAt.toISOString()}`,
  ];
  if (params.excludeReservationId) where.push(sql`${facilityReservations.id} <> ${params.excludeReservationId}`);

  const rows = await params.tx.select({ id: facilityReservations.id }).from(facilityReservations).where(and(...where)).limit(1);
  if (rows[0]) throw conflict("时间段冲突，请查看时间轴并调整");
}

function assertStartEnd(startAt: Date, endAt: Date, maxDurationHours: number) {
  const now = Date.now();
  if (startAt.getTime() <= now) throw badRequest("开始时间必须晚于当前时间");
  if (endAt.getTime() <= startAt.getTime()) throw badRequest("结束时间必须晚于开始时间");

  const maxMs = maxDurationHours * 60 * 60 * 1000;
  if (endAt.getTime() - startAt.getTime() > maxMs) throw badRequest(`使用时长不可超过 ${maxDurationHours} 小时`);
}

export async function createMyReservation(params: {
  userId: string;
  roomId: string;
  startAt: string;
  endAt: string;
  purpose: string;
  participantUserIds: string[];
  actor: AuditActor;
  request: RequestContext;
}) {
  requireUuid(params.roomId, "roomId");
  const startAt = parseIsoDateTime(params.startAt, "startAt");
  const endAt = parseIsoDateTime(params.endAt, "endAt");

  const maxDurationHours = await getConfigNumber("facility.maxDurationHours", 72);
  assertStartEnd(startAt, endAt, maxDurationHours);

  await assertNotBanned(params.userId);

  const participants = normalizeParticipantUserIds({ applicantId: params.userId, participantUserIds: params.participantUserIds });
  await assertActiveUsersExist(participants);

  const auditRequired = await getConfigBool("facility.auditRequired", false);
  const status: ReservationStatus = auditRequired ? "pending" : "approved";

  try {
    const inserted = await db.transaction(async (tx) => {
      await lockRoomOrThrow(tx, params.roomId);
      await assertNoTimeOverlap({ tx, roomId: params.roomId, startAt, endAt });

      const now = new Date();

      const rows = await tx
        .insert(facilityReservations)
        .values({
          roomId: params.roomId,
          applicantId: params.userId,
          purpose: params.purpose.trim(),
          startAt,
          endAt,
          status,
          reviewedBy: status === "approved" ? params.userId : null,
          reviewedAt: status === "approved" ? now : null,
          rejectReason: null,
          cancelledBy: null,
          cancelledAt: null,
          cancelReason: null,
          createdBy: params.userId,
          updatedBy: null,
        })
        .returning({ id: facilityReservations.id });

      const reservationId = rows[0]!.id;

      await tx.insert(facilityReservationParticipants).values(
        participants.map((userId) => ({
          reservationId,
          userId,
          isApplicant: userId === params.userId,
        })),
      );

      return reservationId;
    });

    await writeAuditLog({
      actor: params.actor,
      action: "facility.reservation.create",
      targetType: "facility_reservation",
      targetId: inserted,
      success: true,
      request: params.request,
      diff: { roomId: params.roomId, startAt: startAt.toISOString(), endAt: endAt.toISOString(), status },
    });

    return { id: inserted, status };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "facility.reservation.create",
      targetType: "facility_reservation",
      targetId: params.roomId,
      success: false,
      errorCode: toErrorCode(err),
      reason: err instanceof Error ? err.message : undefined,
      request: params.request,
      diff: { roomId: params.roomId, startAt: startAt.toISOString(), endAt: endAt.toISOString() },
    });
    throw err;
  }
}

export async function updateMyReservation(params: {
  userId: string;
  reservationId: string;
  startAt: string;
  endAt: string;
  purpose: string;
  participantUserIds: string[];
  actor: AuditActor;
  request: RequestContext;
}) {
  requireUuid(params.reservationId, "id");

  const startAt = parseIsoDateTime(params.startAt, "startAt");
  const endAt = parseIsoDateTime(params.endAt, "endAt");

  const maxDurationHours = await getConfigNumber("facility.maxDurationHours", 72);
  assertStartEnd(startAt, endAt, maxDurationHours);

  const participants = normalizeParticipantUserIds({ applicantId: params.userId, participantUserIds: params.participantUserIds });
  await assertActiveUsersExist(participants);

  const auditRequired = await getConfigBool("facility.auditRequired", false);
  const nextStatus: ReservationStatus = auditRequired ? "pending" : "approved";

  try {
    await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: facilityReservations.id,
          roomId: facilityReservations.roomId,
          applicantId: facilityReservations.applicantId,
          status: facilityReservations.status,
        })
        .from(facilityReservations)
        .where(eq(facilityReservations.id, params.reservationId))
        .limit(1);
      const row = rows[0];
      if (!row) throw notFound("预约不存在");
      if (row.applicantId !== params.userId) throw notFound("预约不存在或不可见");
      if (row.status !== "rejected") throw conflict("仅允许修改被驳回的预约");

      await lockRoomOrThrow(tx, row.roomId);
      await assertNoTimeOverlap({ tx, roomId: row.roomId, startAt, endAt, excludeReservationId: row.id });

      const now = new Date();

      await tx
        .update(facilityReservations)
        .set({
          purpose: params.purpose.trim(),
          startAt,
          endAt,
          status: nextStatus,
          reviewedBy: nextStatus === "approved" ? params.userId : null,
          reviewedAt: nextStatus === "approved" ? now : null,
          rejectReason: null,
          cancelledBy: null,
          cancelledAt: null,
          cancelReason: null,
          updatedBy: params.userId,
          updatedAt: sql`now()`,
        })
        .where(eq(facilityReservations.id, row.id));

      await tx.delete(facilityReservationParticipants).where(eq(facilityReservationParticipants.reservationId, row.id));
      await tx.insert(facilityReservationParticipants).values(
        participants.map((userId) => ({
          reservationId: row.id,
          userId,
          isApplicant: userId === params.userId,
        })),
      );
    });

    await writeAuditLog({
      actor: params.actor,
      action: "facility.reservation.resubmit",
      targetType: "facility_reservation",
      targetId: params.reservationId,
      success: true,
      request: params.request,
      diff: { startAt: startAt.toISOString(), endAt: endAt.toISOString(), nextStatus },
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "facility.reservation.resubmit",
      targetType: "facility_reservation",
      targetId: params.reservationId,
      success: false,
      errorCode: toErrorCode(err),
      reason: err instanceof Error ? err.message : undefined,
      request: params.request,
    });
    throw err;
  }
}

export async function cancelMyReservation(params: {
  userId: string;
  reservationId: string;
  reason?: string;
  actor: AuditActor;
  request: RequestContext;
}) {
  requireUuid(params.reservationId, "id");

  try {
    const updated = await db
      .update(facilityReservations)
      .set({
        status: "cancelled",
        cancelledAt: sql`now()`,
        cancelledBy: params.userId,
        cancelReason: params.reason?.trim() ? params.reason.trim() : null,
        updatedAt: sql`now()`,
        updatedBy: params.userId,
      })
      .where(
        and(
          eq(facilityReservations.id, params.reservationId),
          eq(facilityReservations.applicantId, params.userId),
          inArray(facilityReservations.status, ["pending", "approved"]),
          sql`${facilityReservations.startAt} > now()`,
        ),
      )
      .returning({ id: facilityReservations.id });

    if (updated.length === 0) throw conflict("仅允许在开始前取消待审核/已批准的预约");

    await writeAuditLog({
      actor: params.actor,
      action: "facility.reservation.cancel",
      targetType: "facility_reservation",
      targetId: params.reservationId,
      success: true,
      request: params.request,
      reason: params.reason?.trim() ? params.reason.trim() : undefined,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "facility.reservation.cancel",
      targetType: "facility_reservation",
      targetId: params.reservationId,
      success: false,
      errorCode: toErrorCode(err),
      reason: err instanceof Error ? err.message : undefined,
      request: params.request,
    });
    throw err;
  }
}

export async function listMyReservations(params: {
  userId: string;
  page: number;
  pageSize: number;
  status?: ReservationStatus;
}) {
  const where = [eq(facilityReservations.applicantId, params.userId)];
  if (params.status) where.push(eq(facilityReservations.status, params.status));

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(facilityReservations)
    .where(and(...where));

  const rows = await db
    .select({
      id: facilityReservations.id,
      status: facilityReservations.status,
      purpose: facilityReservations.purpose,
      startAt: facilityReservations.startAt,
      endAt: facilityReservations.endAt,
      rejectReason: facilityReservations.rejectReason,
      createdAt: facilityReservations.createdAt,

      roomId: facilityRooms.id,
      roomName: facilityRooms.name,
      floorNo: facilityRooms.floorNo,
      buildingId: facilityBuildings.id,
      buildingName: facilityBuildings.name,

      participantCount: sql<number>`(select count(*) from ${facilityReservationParticipants} p where p.reservation_id = ${facilityReservations.id})`,
    })
    .from(facilityReservations)
    .innerJoin(facilityRooms, eq(facilityRooms.id, facilityReservations.roomId))
    .innerJoin(facilityBuildings, eq(facilityBuildings.id, facilityRooms.buildingId))
    .where(and(...where))
    .orderBy(desc(facilityReservations.createdAt), desc(facilityReservations.id))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      status: r.status as ReservationStatus,
      building: { id: r.buildingId, name: r.buildingName },
      room: { id: r.roomId, name: r.roomName, floorNo: r.floorNo },
      purpose: r.purpose,
      startAt: r.startAt,
      endAt: r.endAt,
      participantCount: Number(r.participantCount ?? 0),
      rejectReason: r.rejectReason,
      createdAt: r.createdAt,
    })),
  };
}

export async function getMyReservationDetail(params: { userId: string; reservationId: string }) {
  requireUuid(params.reservationId, "id");

  const rows = await db
    .select({
      id: facilityReservations.id,
      status: facilityReservations.status,
      purpose: facilityReservations.purpose,
      startAt: facilityReservations.startAt,
      endAt: facilityReservations.endAt,
      rejectReason: facilityReservations.rejectReason,
      createdAt: facilityReservations.createdAt,
      roomId: facilityRooms.id,
      roomName: facilityRooms.name,
      floorNo: facilityRooms.floorNo,
      buildingId: facilityBuildings.id,
      buildingName: facilityBuildings.name,
    })
    .from(facilityReservations)
    .innerJoin(facilityRooms, eq(facilityRooms.id, facilityReservations.roomId))
    .innerJoin(facilityBuildings, eq(facilityBuildings.id, facilityRooms.buildingId))
    .where(and(eq(facilityReservations.id, params.reservationId), eq(facilityReservations.applicantId, params.userId)))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound("预约不存在或不可见");

  const participantRows = await db
    .select({
      userId: facilityReservationParticipants.userId,
      isApplicant: facilityReservationParticipants.isApplicant,
      name: profiles.name,
      studentId: profiles.studentId,
    })
    .from(facilityReservationParticipants)
    .innerJoin(profiles, eq(profiles.id, facilityReservationParticipants.userId))
    .where(eq(facilityReservationParticipants.reservationId, row.id))
    .orderBy(desc(facilityReservationParticipants.isApplicant), asc(profiles.name), asc(profiles.studentId));

  const participants = participantRows.map((p) => ({ id: p.userId, name: p.name, studentId: p.studentId, isApplicant: !!p.isApplicant }));
  const applicant = participants.find((p) => p.isApplicant);

  return {
    id: row.id,
    status: row.status as ReservationStatus,
    building: { id: row.buildingId, name: row.buildingName },
    room: { id: row.roomId, name: row.roomName, floorNo: row.floorNo },
    purpose: row.purpose,
    startAt: row.startAt,
    endAt: row.endAt,
    rejectReason: row.rejectReason,
    participants,
    participantUserIds: participants.filter((p) => !p.isApplicant).map((p) => p.id),
    applicant: applicant ? { id: applicant.id, name: applicant.name, studentId: applicant.studentId } : null,
    createdAt: row.createdAt,
  };
}

async function canManageFacility(actorUserId: string) {
  return hasPerm(actorUserId, "campus:facility:*");
}

export async function getFacilityConfig(params: { actorUserId: string }) {
  const ok = await hasPerm(params.actorUserId, "campus:facility:config");
  const manageAll = await canManageFacility(params.actorUserId);
  if (!ok && !manageAll) throw forbidden();

  const [auditRequired, maxDurationHours] = await Promise.all([
    getConfigBool("facility.auditRequired", false),
    getConfigNumber("facility.maxDurationHours", 72),
  ]);

  return { auditRequired, maxDurationHours };
}

export async function updateFacilityConfig(params: {
  actorUserId: string;
  auditRequired?: boolean;
  maxDurationHours?: number;
  reason?: string;
  actor: AuditActor;
  request: RequestContext;
}) {
  const ok = await hasPerm(params.actorUserId, "campus:facility:config");
  const manageAll = await canManageFacility(params.actorUserId);
  if (!ok && !manageAll) throw forbidden();

  const reason = params.reason?.trim() ? params.reason.trim() : undefined;

  const updates: Array<{ key: string; value: unknown }> = [];
  if (typeof params.auditRequired === "boolean") updates.push({ key: "facility.auditRequired", value: params.auditRequired });
  if (typeof params.maxDurationHours === "number") updates.push({ key: "facility.maxDurationHours", value: String(params.maxDurationHours) });
  if (updates.length === 0) throw badRequest("没有可更新的字段");

  await db.transaction(async (tx) => {
    for (const u of updates) {
      await tx
        .insert(appConfig)
        .values({ key: u.key, value: u.value, updatedBy: params.actorUserId })
        .onConflictDoUpdate({
          target: appConfig.key,
          set: { value: u.value, updatedAt: sql`now()`, updatedBy: params.actorUserId },
        });
    }
  });

  await writeAuditLog({
    actor: params.actor,
    action: "facility.config.update",
    targetType: "app_config",
    targetId: "facility",
    success: true,
    request: params.request,
    reason,
    diff: Object.fromEntries(updates.map((u) => [u.key, u.value])),
  });

  return getFacilityConfig({ actorUserId: params.actorUserId });
}

export async function listConsoleBuildings() {
  const rows = await db
    .select({
      id: facilityBuildings.id,
      name: facilityBuildings.name,
      enabled: facilityBuildings.enabled,
      sort: facilityBuildings.sort,
      remark: facilityBuildings.remark,
      createdAt: facilityBuildings.createdAt,
      updatedAt: facilityBuildings.updatedAt,
    })
    .from(facilityBuildings)
    .where(isNull(facilityBuildings.deletedAt))
    .orderBy(asc(facilityBuildings.sort), asc(facilityBuildings.name), desc(facilityBuildings.createdAt));
  return rows;
}

export async function createConsoleBuilding(params: {
  actorUserId: string;
  name: string;
  enabled: boolean;
  sort: number;
  remark?: string;
  actor: AuditActor;
  request: RequestContext;
}) {
  requireUuid(params.actorUserId, "actorUserId");
  const ok = await canManageFacility(params.actorUserId);
  if (!ok) throw forbidden();

  const name = params.name.trim();
  if (!name) throw badRequest("name 必填");

  try {
    const inserted = await db
      .insert(facilityBuildings)
      .values({
        name,
        enabled: params.enabled,
        sort: params.sort,
        remark: params.remark?.trim() ? params.remark.trim() : null,
      })
      .returning({ id: facilityBuildings.id });

    const id = inserted[0]!.id;
    await writeAuditLog({
      actor: params.actor,
      action: "facility.building.create",
      targetType: "facility_building",
      targetId: id,
      success: true,
      request: params.request,
      diff: { name, enabled: params.enabled, sort: params.sort },
    });
    return { id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "创建失败";
    if (/facility_buildings_name_active_uq/i.test(msg)) throw conflict("楼房名称已存在");
    throw err;
  }
}

export async function updateConsoleBuilding(params: {
  actorUserId: string;
  id: string;
  patch: { name?: string; enabled?: boolean; sort?: number; remark?: string | null };
  actor: AuditActor;
  request: RequestContext;
}) {
  requireUuid(params.id, "id");
  const ok = await canManageFacility(params.actorUserId);
  if (!ok) throw forbidden();

  const set: { name?: string; enabled?: boolean; sort?: number; remark?: string | null } = {};
  if (typeof params.patch.name === "string") set.name = params.patch.name.trim();
  if (typeof params.patch.enabled === "boolean") set.enabled = params.patch.enabled;
  if (typeof params.patch.sort === "number") set.sort = params.patch.sort;
  if (params.patch.remark === null) set.remark = null;
  if (typeof params.patch.remark === "string") set.remark = params.patch.remark.trim() ? params.patch.remark.trim() : null;
  if (Object.keys(set).length === 0) throw badRequest("没有可更新的字段");

  try {
    const updated = await db
      .update(facilityBuildings)
      .set({ ...set, updatedAt: sql`now()` })
      .where(and(eq(facilityBuildings.id, params.id), isNull(facilityBuildings.deletedAt)))
      .returning({ id: facilityBuildings.id });
    if (updated.length === 0) throw notFound("楼房不存在");

    await writeAuditLog({
      actor: params.actor,
      action: "facility.building.update",
      targetType: "facility_building",
      targetId: params.id,
      success: true,
      request: params.request,
      diff: set,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "更新失败";
    if (/facility_buildings_name_active_uq/i.test(msg)) throw conflict("楼房名称已存在");
    throw err;
  }
}

export async function deleteConsoleBuilding(params: {
  actorUserId: string;
  id: string;
  reason?: string;
  actor: AuditActor;
  request: RequestContext;
}) {
  requireUuid(params.id, "id");
  const ok = await canManageFacility(params.actorUserId);
  if (!ok) throw forbidden();

  const roomExists = await db
    .select({ id: facilityRooms.id })
    .from(facilityRooms)
    .where(and(eq(facilityRooms.buildingId, params.id), isNull(facilityRooms.deletedAt)))
    .limit(1);
  if (roomExists[0]) throw conflict("楼房下仍存在房间，禁止删除（请先删除/迁移房间）");

  const updated = await db
    .update(facilityBuildings)
    .set({ deletedAt: sql`now()`, enabled: false, updatedAt: sql`now()` })
    .where(and(eq(facilityBuildings.id, params.id), isNull(facilityBuildings.deletedAt)))
    .returning({ id: facilityBuildings.id });
  if (updated.length === 0) throw notFound("楼房不存在");

  await writeAuditLog({
    actor: params.actor,
    action: "facility.building.delete",
    targetType: "facility_building",
    targetId: params.id,
    success: true,
    request: params.request,
    reason: params.reason?.trim() ? params.reason.trim() : undefined,
  });

  return { ok: true };
}

export async function listConsoleRooms(params: { buildingId?: string; floorNo?: number }) {
  const where = [isNull(facilityRooms.deletedAt), isNull(facilityBuildings.deletedAt)];
  if (params.buildingId) {
    requireUuid(params.buildingId, "buildingId");
    where.push(eq(facilityRooms.buildingId, params.buildingId));
  }
  if (typeof params.floorNo === "number") where.push(eq(facilityRooms.floorNo, params.floorNo));

  const rows = await db
    .select({
      id: facilityRooms.id,
      buildingId: facilityRooms.buildingId,
      buildingName: facilityBuildings.name,
      floorNo: facilityRooms.floorNo,
      name: facilityRooms.name,
      capacity: facilityRooms.capacity,
      enabled: facilityRooms.enabled,
      sort: facilityRooms.sort,
      remark: facilityRooms.remark,
      createdAt: facilityRooms.createdAt,
      updatedAt: facilityRooms.updatedAt,
    })
    .from(facilityRooms)
    .innerJoin(facilityBuildings, eq(facilityBuildings.id, facilityRooms.buildingId))
    .where(and(...where))
    .orderBy(asc(facilityBuildings.sort), asc(facilityRooms.floorNo), asc(facilityRooms.sort), asc(facilityRooms.name));

  return rows;
}

export async function createConsoleRoom(params: {
  actorUserId: string;
  buildingId: string;
  floorNo: number;
  name: string;
  capacity: number | null | undefined;
  enabled: boolean;
  sort: number;
  remark?: string;
  actor: AuditActor;
  request: RequestContext;
}) {
  const ok = await canManageFacility(params.actorUserId);
  if (!ok) throw forbidden();

  requireUuid(params.buildingId, "buildingId");
  const name = params.name.trim();
  if (!name) throw badRequest("name 必填");

  const building = await db
    .select({ id: facilityBuildings.id })
    .from(facilityBuildings)
    .where(and(eq(facilityBuildings.id, params.buildingId), isNull(facilityBuildings.deletedAt)))
    .limit(1);
  if (!building[0]) throw notFound("楼房不存在");

  try {
    const inserted = await db
      .insert(facilityRooms)
      .values({
        buildingId: params.buildingId,
        floorNo: params.floorNo,
        name,
        capacity: params.capacity ?? null,
        enabled: params.enabled,
        sort: params.sort,
        remark: params.remark?.trim() ? params.remark.trim() : null,
      })
      .returning({ id: facilityRooms.id });

    const id = inserted[0]!.id;

    await writeAuditLog({
      actor: params.actor,
      action: "facility.room.create",
      targetType: "facility_room",
      targetId: id,
      success: true,
      request: params.request,
      diff: { buildingId: params.buildingId, floorNo: params.floorNo, name, enabled: params.enabled },
    });

    return { id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "创建失败";
    if (/facility_rooms_name_active_uq/i.test(msg)) throw conflict("同楼房同楼层下房间名称已存在");
    throw err;
  }
}

export async function updateConsoleRoom(params: {
  actorUserId: string;
  id: string;
  patch: { floorNo?: number; name?: string; capacity?: number | null; enabled?: boolean; sort?: number; remark?: string | null };
  actor: AuditActor;
  request: RequestContext;
}) {
  requireUuid(params.id, "id");
  const ok = await canManageFacility(params.actorUserId);
  if (!ok) throw forbidden();

  const set: { floorNo?: number; name?: string; capacity?: number | null; enabled?: boolean; sort?: number; remark?: string | null } = {};
  if (typeof params.patch.floorNo === "number") set.floorNo = params.patch.floorNo;
  if (typeof params.patch.name === "string") set.name = params.patch.name.trim();
  if (typeof params.patch.capacity === "number") set.capacity = params.patch.capacity;
  if (params.patch.capacity === null) set.capacity = null;
  if (typeof params.patch.enabled === "boolean") set.enabled = params.patch.enabled;
  if (typeof params.patch.sort === "number") set.sort = params.patch.sort;
  if (params.patch.remark === null) set.remark = null;
  if (typeof params.patch.remark === "string") set.remark = params.patch.remark.trim() ? params.patch.remark.trim() : null;
  if (Object.keys(set).length === 0) throw badRequest("没有可更新的字段");

  try {
    const updated = await db
      .update(facilityRooms)
      .set({ ...set, updatedAt: sql`now()` })
      .where(and(eq(facilityRooms.id, params.id), isNull(facilityRooms.deletedAt)))
      .returning({ id: facilityRooms.id });
    if (updated.length === 0) throw notFound("房间不存在");

    await writeAuditLog({
      actor: params.actor,
      action: "facility.room.update",
      targetType: "facility_room",
      targetId: params.id,
      success: true,
      request: params.request,
      diff: set,
    });

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "更新失败";
    if (/facility_rooms_name_active_uq/i.test(msg)) throw conflict("同楼房同楼层下房间名称已存在");
    throw err;
  }
}

export async function deleteConsoleRoom(params: {
  actorUserId: string;
  id: string;
  reason?: string;
  actor: AuditActor;
  request: RequestContext;
}) {
  requireUuid(params.id, "id");
  const ok = await canManageFacility(params.actorUserId);
  if (!ok) throw forbidden();

  const exist = await db.select({ id: facilityReservations.id }).from(facilityReservations).where(eq(facilityReservations.roomId, params.id)).limit(1);
  if (exist[0]) throw conflict("房间已有预约记录，禁止删除（建议停用）");

  const updated = await db
    .update(facilityRooms)
    .set({ deletedAt: sql`now()`, enabled: false, updatedAt: sql`now()` })
    .where(and(eq(facilityRooms.id, params.id), isNull(facilityRooms.deletedAt)))
    .returning({ id: facilityRooms.id });
  if (updated.length === 0) throw notFound("房间不存在");

  await writeAuditLog({
    actor: params.actor,
    action: "facility.room.delete",
    targetType: "facility_room",
    targetId: params.id,
    success: true,
    request: params.request,
    reason: params.reason?.trim() ? params.reason.trim() : undefined,
  });

  return { ok: true };
}

export async function listConsoleReservations(params: {
  actorUserId: string;
  page: number;
  pageSize: number;
  status?: ReservationStatus;
  buildingId?: string;
  floorNo?: number;
  roomId?: string;
  q?: string;
  from?: Date;
  to?: Date;
}) {
  const canReview = await hasPerm(params.actorUserId, "campus:facility:review");
  const canManageAll = await canManageFacility(params.actorUserId);
  if (!canReview && !canManageAll) throw forbidden();

  const where = [isNull(facilityBuildings.deletedAt), isNull(facilityRooms.deletedAt)];
  if (params.status) where.push(eq(facilityReservations.status, params.status));
  if (params.buildingId) {
    requireUuid(params.buildingId, "buildingId");
    where.push(eq(facilityRooms.buildingId, params.buildingId));
  }
  if (typeof params.floorNo === "number") where.push(eq(facilityRooms.floorNo, params.floorNo));
  if (params.roomId) {
    requireUuid(params.roomId, "roomId");
    where.push(eq(facilityReservations.roomId, params.roomId));
  }
  if (params.from) where.push(sql`${facilityReservations.endAt} > ${params.from.toISOString()}`);
  if (params.to) where.push(sql`${facilityReservations.startAt} < ${params.to.toISOString()}`);

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    where.push(or(sql`${profiles.name} ilike ${pattern}`, sql`${profiles.studentId} ilike ${pattern}`)!);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(facilityReservations)
    .innerJoin(facilityRooms, eq(facilityRooms.id, facilityReservations.roomId))
    .innerJoin(facilityBuildings, eq(facilityBuildings.id, facilityRooms.buildingId))
    .innerJoin(profiles, eq(profiles.id, facilityReservations.applicantId))
    .where(and(...where));

  const rows = await db
    .select({
      id: facilityReservations.id,
      status: facilityReservations.status,
      purpose: facilityReservations.purpose,
      startAt: facilityReservations.startAt,
      endAt: facilityReservations.endAt,
      applicantId: facilityReservations.applicantId,
      applicantName: profiles.name,
      applicantStudentId: profiles.studentId,
      rejectReason: facilityReservations.rejectReason,
      reviewedBy: facilityReservations.reviewedBy,
      reviewedAt: facilityReservations.reviewedAt,
      cancelledBy: facilityReservations.cancelledBy,
      cancelledAt: facilityReservations.cancelledAt,
      cancelReason: facilityReservations.cancelReason,
      createdAt: facilityReservations.createdAt,
      roomId: facilityRooms.id,
      roomName: facilityRooms.name,
      floorNo: facilityRooms.floorNo,
      buildingId: facilityBuildings.id,
      buildingName: facilityBuildings.name,
      participantCount: sql<number>`(select count(*) from ${facilityReservationParticipants} p where p.reservation_id = ${facilityReservations.id})`,
    })
    .from(facilityReservations)
    .innerJoin(facilityRooms, eq(facilityRooms.id, facilityReservations.roomId))
    .innerJoin(facilityBuildings, eq(facilityBuildings.id, facilityRooms.buildingId))
    .innerJoin(profiles, eq(profiles.id, facilityReservations.applicantId))
    .where(and(...where))
    .orderBy(desc(facilityReservations.createdAt), desc(facilityReservations.id))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      status: r.status as ReservationStatus,
      purpose: r.purpose,
      startAt: r.startAt,
      endAt: r.endAt,
      applicant: { id: r.applicantId, name: r.applicantName, studentId: r.applicantStudentId },
      building: { id: r.buildingId, name: r.buildingName },
      room: { id: r.roomId, name: r.roomName, floorNo: r.floorNo },
      participantCount: Number(r.participantCount ?? 0),
      review: { reviewedBy: r.reviewedBy, reviewedAt: r.reviewedAt, rejectReason: r.rejectReason },
      cancel: { cancelledBy: r.cancelledBy, cancelledAt: r.cancelledAt, reason: r.cancelReason },
      createdAt: r.createdAt,
    })),
  };
}

export async function approveReservation(params: {
  actorUserId: string;
  reservationId: string;
  actor: AuditActor;
  request: RequestContext;
}) {
  requireUuid(params.reservationId, "id");
  const canReview = await hasPerm(params.actorUserId, "campus:facility:review");
  const canManageAll = await canManageFacility(params.actorUserId);
  if (!canReview && !canManageAll) throw forbidden();

  try {
    const updated = await db
      .update(facilityReservations)
      .set({ status: "approved", reviewedBy: params.actorUserId, reviewedAt: sql`now()`, rejectReason: null, updatedAt: sql`now()`, updatedBy: params.actorUserId })
      .where(and(eq(facilityReservations.id, params.reservationId), eq(facilityReservations.status, "pending")))
      .returning({ id: facilityReservations.id });

    if (updated.length === 0) throw conflict("仅允许审核待审核预约");

    await writeAuditLog({
      actor: params.actor,
      action: "facility.reservation.approve",
      targetType: "facility_reservation",
      targetId: params.reservationId,
      success: true,
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "facility.reservation.approve",
      targetType: "facility_reservation",
      targetId: params.reservationId,
      success: false,
      errorCode: toErrorCode(err),
      reason: err instanceof Error ? err.message : undefined,
      request: params.request,
    });
    throw err;
  }
}

export async function rejectReservation(params: {
  actorUserId: string;
  reservationId: string;
  reason: string;
  actor: AuditActor;
  request: RequestContext;
}) {
  requireUuid(params.reservationId, "id");
  const canReview = await hasPerm(params.actorUserId, "campus:facility:review");
  const canManageAll = await canManageFacility(params.actorUserId);
  if (!canReview && !canManageAll) throw forbidden();
  const reason = params.reason.trim();
  if (!reason) throw badRequest("reason 必填");

  try {
    const updated = await db
      .update(facilityReservations)
      .set({ status: "rejected", reviewedBy: params.actorUserId, reviewedAt: sql`now()`, rejectReason: reason, updatedAt: sql`now()`, updatedBy: params.actorUserId })
      .where(and(eq(facilityReservations.id, params.reservationId), eq(facilityReservations.status, "pending")))
      .returning({ id: facilityReservations.id });

    if (updated.length === 0) throw conflict("仅允许审核待审核预约");

    await writeAuditLog({
      actor: params.actor,
      action: "facility.reservation.reject",
      targetType: "facility_reservation",
      targetId: params.reservationId,
      success: true,
      request: params.request,
      reason,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "facility.reservation.reject",
      targetType: "facility_reservation",
      targetId: params.reservationId,
      success: false,
      errorCode: toErrorCode(err),
      reason: err instanceof Error ? err.message : undefined,
      request: params.request,
    });
    throw err;
  }
}

export async function listConsoleBans(params: { actorUserId: string }) {
  const canBan = await hasPerm(params.actorUserId, "campus:facility:ban");
  const canManageAll = await canManageFacility(params.actorUserId);
  if (!canBan && !canManageAll) throw forbidden();

  const rows = await db
    .select({
      id: facilityBans.id,
      userId: facilityBans.userId,
      name: profiles.name,
      studentId: profiles.studentId,
      reason: facilityBans.reason,
      expiresAt: facilityBans.expiresAt,
      revokedAt: facilityBans.revokedAt,
      createdBy: facilityBans.createdBy,
      revokedBy: facilityBans.revokedBy,
      createdAt: facilityBans.createdAt,
    })
    .from(facilityBans)
    .innerJoin(profiles, eq(profiles.id, facilityBans.userId))
    .orderBy(desc(facilityBans.createdAt), desc(facilityBans.id))
    .limit(200);

  const now = Date.now();

  return {
    items: rows.map((r) => {
      const active = !r.revokedAt && (!r.expiresAt || r.expiresAt.getTime() > now);
      return {
        id: r.id,
        user: { id: r.userId, name: r.name, studentId: r.studentId },
        reason: r.reason,
        expiresAt: r.expiresAt,
        revokedAt: r.revokedAt,
        active,
        createdBy: r.createdBy,
        revokedBy: r.revokedBy,
        createdAt: r.createdAt,
      };
    }),
  };
}

export async function createConsoleBan(params: {
  actorUserId: string;
  userId: string;
  duration?: string;
  expiresAt?: string;
  reason?: string;
  actor: AuditActor;
  request: RequestContext;
}) {
  const canBan = await hasPerm(params.actorUserId, "campus:facility:ban");
  const canManageAll = await canManageFacility(params.actorUserId);
  if (!canBan && !canManageAll) throw forbidden();

  requireUuid(params.userId, "userId");

  const reason = params.reason?.trim() ? params.reason.trim() : null;
  if (reason && reason.length > 500) throw badRequest("reason 过长");

  let expiresAt: Date | null = null;
  if (params.duration && params.duration.trim()) {
    const ms = parseDurationMs(params.duration);
    expiresAt = new Date(Date.now() + ms);
  } else if (params.expiresAt && params.expiresAt.trim()) {
    expiresAt = parseIsoDateTime(params.expiresAt, "expiresAt");
  }
  if (expiresAt && expiresAt.getTime() <= Date.now()) throw badRequest("expiresAt 必须晚于当前时间");

  await db.transaction(async (tx) => {
    await tx.update(facilityBans).set({ revokedAt: sql`now()`, revokedBy: params.actorUserId, revokedReason: "被新封禁覆盖" }).where(and(eq(facilityBans.userId, params.userId), isNull(facilityBans.revokedAt)));
    await tx.insert(facilityBans).values({
      userId: params.userId,
      reason,
      expiresAt,
      revokedAt: null,
      revokedReason: null,
      createdBy: params.actorUserId,
      revokedBy: null,
    });
  });

  await writeAuditLog({
    actor: params.actor,
    action: "facility.ban.create",
    targetType: "facility_ban",
    targetId: params.userId,
    success: true,
    request: params.request,
    reason: reason ?? undefined,
    diff: { expiresAt: expiresAt ? expiresAt.toISOString() : null },
  });

  return { ok: true };
}

export async function revokeConsoleBan(params: {
  actorUserId: string;
  banId: string;
  reason?: string;
  actor: AuditActor;
  request: RequestContext;
}) {
  const canBan = await hasPerm(params.actorUserId, "campus:facility:ban");
  const canManageAll = await canManageFacility(params.actorUserId);
  if (!canBan && !canManageAll) throw forbidden();

  requireUuid(params.banId, "id");

  const updated = await db
    .update(facilityBans)
    .set({ revokedAt: sql`now()`, revokedBy: params.actorUserId, revokedReason: params.reason?.trim() ? params.reason.trim() : null })
    .where(and(eq(facilityBans.id, params.banId), isNull(facilityBans.revokedAt)))
    .returning({ id: facilityBans.id });

  if (updated.length === 0) throw conflict("封禁不存在或已解封");

  await writeAuditLog({
    actor: params.actor,
    action: "facility.ban.revoke",
    targetType: "facility_ban",
    targetId: params.banId,
    success: true,
    request: params.request,
    reason: params.reason?.trim() ? params.reason.trim() : undefined,
  });

  return { ok: true };
}

function parseDaysQuery(days: number) {
  return days === 7 ? 7 : days === 30 ? 30 : null;
}

export async function getRoomLeaderboard(params: { userId: string; days: number }) {
  const days = parseDaysQuery(params.days);
  if (!days) throw badRequest("days 仅支持 7 或 30");

  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const to = new Date();
  const overlapSumSeconds = sql<number>`sum(greatest(0, extract(epoch from least(${facilityReservations.endAt}, ${to.toISOString()}) - greatest(${facilityReservations.startAt}, ${from.toISOString()}))))`;

  const rows = await db
    .select({
      roomId: facilityRooms.id,
      roomName: facilityRooms.name,
      buildingName: facilityBuildings.name,
      floorNo: facilityRooms.floorNo,
      totalSeconds: overlapSumSeconds,
    })
    .from(facilityReservations)
    .innerJoin(facilityRooms, eq(facilityRooms.id, facilityReservations.roomId))
    .innerJoin(facilityBuildings, eq(facilityBuildings.id, facilityRooms.buildingId))
    .where(
      and(
        inArray(facilityReservations.status, ["approved"]),
        isNull(facilityRooms.deletedAt),
        isNull(facilityBuildings.deletedAt),
        sql`${facilityReservations.startAt} < ${to.toISOString()}`,
        sql`${facilityReservations.endAt} > ${from.toISOString()}`,
      ),
    )
    .groupBy(facilityRooms.id, facilityRooms.name, facilityBuildings.name, facilityRooms.floorNo)
    .orderBy(desc(overlapSumSeconds))
    .limit(50);

  return {
    days,
    items: rows.map((r) => ({
      id: r.roomId,
      label: `${r.buildingName} / ${r.floorNo}F / ${r.roomName}`,
      totalSeconds: Math.floor(Number(r.totalSeconds ?? 0)),
    })),
  };
}

export async function getUserLeaderboard(params: { userId: string; days: number }) {
  const days = parseDaysQuery(params.days);
  if (!days) throw badRequest("days 仅支持 7 或 30");

  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const to = new Date();
  const overlapSumSeconds = sql<number>`sum(greatest(0, extract(epoch from least(${facilityReservations.endAt}, ${to.toISOString()}) - greatest(${facilityReservations.startAt}, ${from.toISOString()}))))`;

  const rows = await db
    .select({
      userId: profiles.id,
      name: profiles.name,
      studentId: profiles.studentId,
      totalSeconds: overlapSumSeconds,
    })
    .from(facilityReservations)
    .innerJoin(profiles, eq(profiles.id, facilityReservations.applicantId))
    .where(
      and(
        inArray(facilityReservations.status, ["approved"]),
        sql`${facilityReservations.startAt} < ${to.toISOString()}`,
        sql`${facilityReservations.endAt} > ${from.toISOString()}`,
      ),
    )
    .groupBy(profiles.id, profiles.name, profiles.studentId)
    .orderBy(desc(overlapSumSeconds))
    .limit(50);

  return {
    days,
    items: rows.map((r) => ({
      id: r.userId,
      label: `${r.name}（${r.studentId}）`,
      totalSeconds: Math.floor(Number(r.totalSeconds ?? 0)),
    })),
  };
}
