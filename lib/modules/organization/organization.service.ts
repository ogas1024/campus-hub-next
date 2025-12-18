import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/http/errors";
import type { RequestContext } from "@/lib/http/route";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import { writeAuditLog } from "@/lib/modules/audit/audit.service";
import { departments, positions, userDepartments } from "@campus-hub/db";

export async function listDepartments() {
  const rows = await db
    .select({
      id: departments.id,
      name: departments.name,
      parentId: departments.parentId,
      sort: departments.sort,
    })
    .from(departments)
    .orderBy(asc(departments.sort), asc(departments.name));

  return { items: rows };
}

export async function createDepartment(params: {
  name: string;
  parentId?: string | null;
  sort: number;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  try {
    const inserted = await db
      .insert(departments)
      .values({ name: params.name, parentId: params.parentId ?? null, sort: params.sort })
      .returning({ id: departments.id });

    await writeAuditLog({
      actor: params.actor,
      action: "department.create",
      targetType: "department",
      targetId: inserted[0]!.id,
      success: true,
      reason: params.reason,
      diff: { name: params.name, parentId: params.parentId ?? null, sort: params.sort },
      request: params.request,
    });

    return inserted[0]!.id;
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "department.create",
      targetType: "department",
      targetId: "new",
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { name: params.name, parentId: params.parentId ?? null, sort: params.sort },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function updateDepartment(params: {
  id: string;
  name?: string;
  parentId?: string | null;
  sort?: number;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  const existingRows = await db
    .select({ id: departments.id, name: departments.name, parentId: departments.parentId, sort: departments.sort })
    .from(departments)
    .where(eq(departments.id, params.id))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) throw notFound("部门不存在");

  const next = {
    name: params.name ?? existing.name,
    parentId: params.parentId !== undefined ? params.parentId : existing.parentId,
    sort: params.sort ?? existing.sort,
  };

  if (next.name === existing.name && next.parentId === existing.parentId && next.sort === existing.sort) {
    return { ok: true };
  }

  try {
    await db
      .update(departments)
      .set({ name: next.name, parentId: next.parentId ?? null, sort: next.sort })
      .where(eq(departments.id, params.id));

    await writeAuditLog({
      actor: params.actor,
      action: "department.update",
      targetType: "department",
      targetId: params.id,
      success: true,
      reason: params.reason,
      diff: { before: existing, after: next },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "department.update",
      targetType: "department",
      targetId: params.id,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { before: existing, after: next },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function deleteDepartment(params: {
  id: string;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  const existingRows = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.id, params.id))
    .limit(1);
  if (!existingRows[0]) throw notFound("部门不存在");

  const childRows = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.parentId, params.id))
    .limit(1);
  if (childRows[0]) throw conflict("该部门存在子部门，禁止删除");

  const bindRows = await db
    .select({ userId: userDepartments.userId })
    .from(userDepartments)
    .where(eq(userDepartments.departmentId, params.id))
    .limit(1);
  if (bindRows[0]) throw conflict("该部门存在用户绑定，禁止删除");

  try {
    await db.delete(departments).where(eq(departments.id, params.id));

    await writeAuditLog({
      actor: params.actor,
      action: "department.delete",
      targetType: "department",
      targetId: params.id,
      success: true,
      reason: params.reason,
      diff: null,
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "department.delete",
      targetType: "department",
      targetId: params.id,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: null,
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function listPositions() {
  const rows = await db
    .select({
      id: positions.id,
      code: positions.code,
      name: positions.name,
      description: positions.description,
      enabled: positions.enabled,
      sort: positions.sort,
      createdAt: positions.createdAt,
      updatedAt: positions.updatedAt,
    })
    .from(positions)
    .orderBy(asc(positions.sort), asc(positions.name));

  return { items: rows };
}

export async function createPosition(params: {
  code?: string;
  name: string;
  description?: string;
  enabled: boolean;
  sort: number;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  try {
    const inserted = await db
      .insert(positions)
      .values({
        code: params.code ?? null,
        name: params.name,
        description: params.description ?? null,
        enabled: params.enabled,
        sort: params.sort,
      })
      .returning({ id: positions.id });

    await writeAuditLog({
      actor: params.actor,
      action: "position.create",
      targetType: "position",
      targetId: inserted[0]!.id,
      success: true,
      reason: params.reason,
      diff: {
        code: params.code ?? null,
        name: params.name,
        description: params.description ?? null,
        enabled: params.enabled,
        sort: params.sort,
      },
      request: params.request,
    });

    return inserted[0]!.id;
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "position.create",
      targetType: "position",
      targetId: "new",
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: {
        code: params.code ?? null,
        name: params.name,
        description: params.description ?? null,
        enabled: params.enabled,
        sort: params.sort,
      },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function updatePosition(params: {
  id: string;
  code?: string | null;
  name?: string;
  description?: string | null;
  enabled?: boolean;
  sort?: number;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  const existingRows = await db
    .select({
      id: positions.id,
      code: positions.code,
      name: positions.name,
      description: positions.description,
      enabled: positions.enabled,
      sort: positions.sort,
    })
    .from(positions)
    .where(eq(positions.id, params.id))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) throw notFound("岗位不存在");

  const next = {
    code: params.code !== undefined ? params.code : existing.code,
    name: params.name ?? existing.name,
    description: params.description !== undefined ? params.description : existing.description,
    enabled: params.enabled ?? existing.enabled,
    sort: params.sort ?? existing.sort,
  };

  if (
    next.code === existing.code &&
    next.name === existing.name &&
    next.description === existing.description &&
    next.enabled === existing.enabled &&
    next.sort === existing.sort
  ) {
    return { ok: true };
  }

  try {
    await db
      .update(positions)
      .set({
        code: next.code ?? null,
        name: next.name,
        description: next.description ?? null,
        enabled: next.enabled,
        sort: next.sort,
      })
      .where(eq(positions.id, params.id));

    await writeAuditLog({
      actor: params.actor,
      action: "position.update",
      targetType: "position",
      targetId: params.id,
      success: true,
      reason: params.reason,
      diff: { before: existing, after: next },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "position.update",
      targetType: "position",
      targetId: params.id,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { before: existing, after: next },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function deletePosition(params: {
  id: string;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  const existingRows = await db
    .select({ id: positions.id })
    .from(positions)
    .where(eq(positions.id, params.id))
    .limit(1);

  if (!existingRows[0]) throw notFound("岗位不存在");

  try {
    await db.delete(positions).where(eq(positions.id, params.id));

    await writeAuditLog({
      actor: params.actor,
      action: "position.delete",
      targetType: "position",
      targetId: params.id,
      success: true,
      reason: params.reason,
      diff: null,
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "position.delete",
      targetType: "position",
      targetId: params.id,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: null,
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}
