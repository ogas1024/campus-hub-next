import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { forbidden } from "@/lib/http/errors";
import { requireUser } from "@/lib/auth/session";
import { requestCached } from "@/lib/utils/requestCache";
import { permissions, rolePermissions, userRoles } from "@campus-hub/db";

function expandPermCandidates(permCode: string) {
  const code = permCode.trim();
  if (!code) return [];

  const parts = code.split(":");
  if (parts.length < 2) return [code];
  if (parts[0] !== "campus") return [code];

  const rest = parts.slice(1);
  const out = new Set<string>();

  for (let mask = 0; mask < 1 << rest.length; mask += 1) {
    const next = rest.map((seg, idx) => (((mask >> idx) & 1) === 1 ? "*" : seg));
    out.add(["campus", ...next].join(":"));
  }

  return [...out];
}

export async function getUserPermissionCodeSet(userId: string): Promise<Set<string>> {
  const key = `auth:userPermissionCodes:${userId}`;
  return requestCached(key, async () => {
    const rows = await db
      .select({ code: permissions.code })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, userId));

    return new Set(rows.map((r) => r.code));
  });
}

function matchesAnyPerm(granted: Set<string>, permCodes: string[]) {
  const inputs = [...new Set(permCodes)].map((c) => c.trim()).filter(Boolean);
  if (inputs.length === 0) return false;
  if (granted.size === 0) return false;

  for (const code of inputs) {
    for (const c of expandPermCandidates(code)) {
      if (granted.has(c)) return true;
    }
  }
  return false;
}

export async function getPermissionChecker(userId: string) {
  const granted = await getUserPermissionCodeSet(userId);
  return {
    granted,
    hasPerm(permCode: string) {
      return matchesAnyPerm(granted, [permCode]);
    },
    hasAnyPerm(permCodes: string[]) {
      return matchesAnyPerm(granted, permCodes);
    },
  };
}

export async function hasPerm(userId: string, permCode: string) {
  const checker = await getPermissionChecker(userId);
  return checker.hasPerm(permCode);
}

export async function hasAnyPerm(userId: string, permCodes: string[]) {
  const checker = await getPermissionChecker(userId);
  return checker.hasAnyPerm(permCodes);
}

export async function requirePerm(permCode: string) {
  const user = await requireUser();

  const ok = await hasPerm(user.id, permCode);
  if (!ok) throw forbidden();
  return user;
}

export async function requireAnyPerm(permCodes: string[]) {
  const user = await requireUser();

  const ok = await hasAnyPerm(user.id, permCodes);
  if (!ok) throw forbidden();
  return user;
}
