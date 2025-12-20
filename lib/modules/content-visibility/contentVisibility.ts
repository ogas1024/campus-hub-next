import "server-only";

import { and, eq, inArray, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/db";
import { departmentClosure, userDepartments, userPositions, userRoles } from "@campus-hub/db";

export type AudienceContext = {
  roleIds: string[];
  departmentIds: string[];
  positionIds: string[];
};

type ScopeType = "role" | "department" | "position";

type ScopeTypeColumn = AnyPgColumn<{ data: ScopeType }>;
type IdColumn = AnyPgColumn<{ data: string }>;
type VisibleAllColumn = AnyPgColumn<{ data: boolean }>;

export async function getAudienceContext(userId: string): Promise<AudienceContext> {
  const [roleRows, deptRows, positionRows] = await Promise.all([
    db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId)),
    db.select({ departmentId: userDepartments.departmentId }).from(userDepartments).where(eq(userDepartments.userId, userId)),
    db.select({ positionId: userPositions.positionId }).from(userPositions).where(eq(userPositions.userId, userId)),
  ]);

  return {
    roleIds: roleRows.map((r) => r.roleId),
    departmentIds: deptRows.map((d) => d.departmentId),
    positionIds: positionRows.map((p) => p.positionId),
  };
}

export async function getVisibleIdsForUser(params: {
  ctx: AudienceContext;
  scopesTable: AnyPgTable;
  resourceIdColumn: IdColumn;
  scopeTypeColumn: ScopeTypeColumn;
  refIdColumn: IdColumn;
}): Promise<string[]> {
  const idSet = new Set<string>();

  if (params.ctx.roleIds.length > 0) {
    const rows = await db
      .select({ resourceId: params.resourceIdColumn })
      .from(params.scopesTable)
      .where(and(eq(params.scopeTypeColumn, "role"), inArray(params.refIdColumn, params.ctx.roleIds)));
    for (const r of rows) {
      if (r.resourceId) idSet.add(r.resourceId);
    }
  }

  if (params.ctx.departmentIds.length > 0) {
    const rows = await db
      .select({ resourceId: params.resourceIdColumn })
      .from(params.scopesTable)
      .innerJoin(
        departmentClosure,
        and(eq(departmentClosure.ancestorId, params.refIdColumn), inArray(departmentClosure.descendantId, params.ctx.departmentIds)),
      )
      .where(eq(params.scopeTypeColumn, "department"));
    for (const r of rows) {
      if (r.resourceId) idSet.add(r.resourceId);
    }
  }

  if (params.ctx.positionIds.length > 0) {
    const rows = await db
      .select({ resourceId: params.resourceIdColumn })
      .from(params.scopesTable)
      .where(and(eq(params.scopeTypeColumn, "position"), inArray(params.refIdColumn, params.ctx.positionIds)));
    for (const r of rows) {
      if (r.resourceId) idSet.add(r.resourceId);
    }
  }

  return [...idSet];
}

export function buildVisibilityCondition(params: {
  visibleIds: string[];
  visibleAllColumn: VisibleAllColumn;
  idColumn: IdColumn;
}): SQL {
  if (params.visibleIds.length === 0) return eq(params.visibleAllColumn, true);
  return or(eq(params.visibleAllColumn, true), inArray(params.idColumn, params.visibleIds)) ?? eq(params.visibleAllColumn, true);
}
