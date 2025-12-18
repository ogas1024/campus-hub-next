import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { forbidden } from "@/lib/http/errors";
import { requireUser } from "@/lib/auth/session";
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

export async function hasPerm(userId: string, permCode: string) {
  const candidates = expandPermCandidates(permCode);
  if (candidates.length === 0) return false;

  const rows = await db
    .select({ ok: userRoles.userId })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(userRoles.userId, userId), inArray(permissions.code, candidates)))
    .limit(1);

  return rows.length > 0;
}

export async function hasAnyPerm(userId: string, permCodes: string[]) {
  const inputs = [...new Set(permCodes)].map((c) => c.trim()).filter(Boolean);
  if (inputs.length === 0) return false;

  const candidateSet = new Set<string>();
  for (const code of inputs) {
    for (const c of expandPermCandidates(code)) candidateSet.add(c);
  }

  const candidates = [...candidateSet];
  if (candidates.length === 0) return false;

  const rows = await db
    .select({ ok: userRoles.userId })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(userRoles.userId, userId), inArray(permissions.code, candidates)))
    .limit(1);

  return rows.length > 0;
}

export async function requirePerm(permCode: string) {
  const user = await requireUser();

  const ok = await hasPerm(user.id, permCode);
  if (!ok) throw forbidden();
  return user;
}
