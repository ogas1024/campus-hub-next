import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { forbidden } from "@/lib/http/errors";
import { requireUser } from "@/lib/auth/session";
import { permissions, rolePermissions, userRoles } from "@campus-hub/db";

export async function hasPerm(userId: string, permCode: string) {
  const rows = await db
    .select({ ok: userRoles.userId })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(userRoles.userId, userId), eq(permissions.code, permCode)))
    .limit(1);

  return rows.length > 0;
}

export async function requirePerm(permCode: string) {
  const user = await requireUser();

  const ok = await hasPerm(user.id, permCode);
  if (!ok) throw forbidden();
  return user;
}
