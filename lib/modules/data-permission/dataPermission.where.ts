import "server-only";

import { eq, inArray, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "@/lib/db";
import { userDepartments } from "@campus-hub/db";
import { resolveMergedScopeForUser, type ResolvedDataScope } from "./dataPermission.service";

export async function buildUserIdDataScopeCondition(params: {
  actorUserId: string;
  module: string;
  targetUserIdColumn: AnyPgColumn;
}): Promise<{ scope: ResolvedDataScope; condition: SQL | undefined }> {
  const scope = await resolveMergedScopeForUser({ userId: params.actorUserId, module: params.module });

  if (scope.scopeType === "ALL") return { scope, condition: undefined };
  if (scope.scopeType === "NONE") return { scope, condition: sql`false` };
  if (scope.scopeType === "SELF") return { scope, condition: eq(params.targetUserIdColumn, params.actorUserId) };

  if (scope.scopeType === "DEPT" || scope.scopeType === "DEPT_AND_CHILD" || scope.scopeType === "CUSTOM") {
    const ids = scope.departmentIds;
    if (!ids || ids.length === 0) return { scope, condition: sql`false` };

    const userIdSubQuery = db
      .select({ userId: userDepartments.userId })
      .from(userDepartments)
      .where(inArray(userDepartments.departmentId, ids));

    return { scope, condition: inArray(params.targetUserIdColumn, userIdSubQuery) };
  }

  return { scope, condition: sql`false` };
}

