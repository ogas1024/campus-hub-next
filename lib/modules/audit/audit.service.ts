import "server-only";

import { and, asc, desc, eq, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/http/errors";
import type { RequestContext } from "@/lib/http/route";
import { auditLogs, roles, userRoles } from "@campus-hub/db";

export type AuditActor = {
  userId: string;
  email: string | null;
};

export type WriteAuditLogParams = {
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId: string;
  success: boolean;
  errorCode?: string;
  reason?: string;
  diff?: unknown;
  request: RequestContext;
};

async function getActorRoleCodes(userId: string) {
  const rows = await db
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
    .orderBy(asc(roles.code));
  return rows.map((r) => r.code);
}

export async function writeAuditLog(params: WriteAuditLogParams) {
  const actorRoleCodes = await getActorRoleCodes(params.actor.userId);

  const inserted = await db
    .insert(auditLogs)
    .values({
      actorUserId: params.actor.userId,
      actorEmail: params.actor.email,
      actorRoles: { roleCodes: actorRoleCodes },
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      success: params.success,
      errorCode: params.errorCode ?? null,
      reason: params.reason ?? null,
      diff: params.diff ?? null,
      requestId: params.request.requestId,
      ip: params.request.ip,
      userAgent: params.request.userAgent,
    })
    .returning({ id: auditLogs.id });

  return { id: inserted[0]!.id };
}

export async function listAuditLogs(params: {
  page: number;
  pageSize: number;
  q?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  actorUserId?: string;
  success?: boolean;
  from?: Date;
  to?: Date;
}) {
  const where = [];

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    where.push(
      or(
        sql`${auditLogs.action} ilike ${pattern}`,
        sql`${auditLogs.targetId} ilike ${pattern}`,
        sql`${auditLogs.actorEmail} ilike ${pattern}`,
      )!,
    );
  }
  if (params.action) where.push(eq(auditLogs.action, params.action));
  if (params.targetType) where.push(eq(auditLogs.targetType, params.targetType));
  if (params.targetId) where.push(eq(auditLogs.targetId, params.targetId));
  if (params.actorUserId) where.push(eq(auditLogs.actorUserId, params.actorUserId));
  if (typeof params.success === "boolean") where.push(eq(auditLogs.success, params.success));
  if (params.from) where.push(sql`${auditLogs.occurredAt} >= ${params.from.toISOString()}`);
  if (params.to) where.push(sql`${auditLogs.occurredAt} <= ${params.to.toISOString()}`);

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(auditLogs)
    .where(where.length > 0 ? and(...where) : undefined);

  const rows = await db
    .select({
      id: auditLogs.id,
      occurredAt: auditLogs.occurredAt,
      actorUserId: auditLogs.actorUserId,
      actorEmail: auditLogs.actorEmail,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      success: auditLogs.success,
    })
    .from(auditLogs)
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(auditLogs.occurredAt), desc(auditLogs.id))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows,
  };
}

export async function getAuditLogDetail(id: string) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw badRequest("id 必须为 UUID");

  const rows = await db
    .select({
      id: auditLogs.id,
      occurredAt: auditLogs.occurredAt,
      actorUserId: auditLogs.actorUserId,
      actorEmail: auditLogs.actorEmail,
      actorRoles: auditLogs.actorRoles,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      success: auditLogs.success,
      errorCode: auditLogs.errorCode,
      reason: auditLogs.reason,
      diff: auditLogs.diff,
      requestId: auditLogs.requestId,
      ip: auditLogs.ip,
      userAgent: auditLogs.userAgent,
    })
    .from(auditLogs)
    .where(eq(auditLogs.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound("审计记录不存在");
  return row;
}

