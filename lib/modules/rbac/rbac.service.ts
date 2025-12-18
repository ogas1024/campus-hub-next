import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/http/errors";
import type { RequestContext } from "@/lib/http/route";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import { writeAuditLog } from "@/lib/modules/audit/audit.service";
import { permissions, rolePermissions, roles } from "@campus-hub/db";

const BUILTIN_ROLE_CODES = new Set(["user", "admin", "super_admin"]);

function assertRoleCode(code: string) {
  const ok = /^[a-z][a-z0-9_]*$/.test(code);
  if (!ok) throw badRequest("角色 code 仅允许小写字母/数字/下划线，且必须以字母开头");
}

export async function listRoles() {
  const rows = await db
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
      createdAt: roles.createdAt,
      updatedAt: roles.updatedAt,
    })
    .from(roles)
    .orderBy(asc(roles.code));

  return { items: rows };
}

export async function createRole(params: {
  code: string;
  name: string;
  description?: string;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  assertRoleCode(params.code);

  try {
    const inserted = await db
      .insert(roles)
      .values({ code: params.code, name: params.name, description: params.description ?? null })
      .returning({ id: roles.id });

    await writeAuditLog({
      actor: params.actor,
      action: "role.create",
      targetType: "role",
      targetId: inserted[0]!.id,
      success: true,
      reason: params.reason,
      diff: { code: params.code, name: params.name, description: params.description ?? null },
      request: params.request,
    });

    return inserted[0]!.id;
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "role.create",
      targetType: "role",
      targetId: "new",
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { code: params.code, name: params.name, description: params.description ?? null },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function updateRole(params: {
  id: string;
  name?: string;
  description?: string | null;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  const existingRows = await db
    .select({ id: roles.id, code: roles.code, name: roles.name, description: roles.description })
    .from(roles)
    .where(eq(roles.id, params.id))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) throw notFound("角色不存在");

  const next = {
    name: params.name ?? existing.name,
    description: params.description !== undefined ? params.description : existing.description,
  };

  if (next.name === existing.name && next.description === existing.description) return { ok: true };

  try {
    await db
      .update(roles)
      .set({ name: next.name, description: next.description ?? null })
      .where(eq(roles.id, params.id));

    await writeAuditLog({
      actor: params.actor,
      action: "role.update",
      targetType: "role",
      targetId: params.id,
      success: true,
      reason: params.reason,
      diff: { before: existing, after: { ...existing, ...next } },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "role.update",
      targetType: "role",
      targetId: params.id,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { before: existing, after: { ...existing, ...next } },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function deleteRole(params: {
  id: string;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  const existingRows = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(eq(roles.id, params.id))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) throw notFound("角色不存在");
  if (BUILTIN_ROLE_CODES.has(existing.code)) throw conflict("内置角色不可删除");

  try {
    await db.delete(roles).where(eq(roles.id, params.id));

    await writeAuditLog({
      actor: params.actor,
      action: "role.delete",
      targetType: "role",
      targetId: params.id,
      success: true,
      reason: params.reason,
      diff: { code: existing.code },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "role.delete",
      targetType: "role",
      targetId: params.id,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { code: existing.code },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function listPermissions() {
  const rows = await db
    .select({ id: permissions.id, code: permissions.code, description: permissions.description, createdAt: permissions.createdAt })
    .from(permissions)
    .orderBy(asc(permissions.code));

  return { items: rows };
}

export async function getRolePermissionCodes(roleId: string) {
  const roleRow = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!roleRow[0]) throw notFound("角色不存在");

  const rows = await db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId))
    .orderBy(asc(permissions.code));

  return { roleId, permissionCodes: rows.map((r) => r.code) };
}

export async function setRolePermissions(params: {
  roleId: string;
  permissionCodes: string[];
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  const roleRows = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(eq(roles.id, params.roleId))
    .limit(1);
  const role = roleRows[0];
  if (!role) throw notFound("角色不存在");

  const uniqueCodes = [...new Set(params.permissionCodes.map((c) => c.trim()).filter(Boolean))];

  const beforeRows = await db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, params.roleId));
  const beforeCodes = beforeRows.map((r) => r.code).sort();

  const permRows =
    uniqueCodes.length === 0
      ? []
      : await db
          .select({ id: permissions.id, code: permissions.code })
          .from(permissions)
          .where(inArray(permissions.code, uniqueCodes));

  if (permRows.length !== uniqueCodes.length) {
    const found = new Set(permRows.map((p) => p.code));
    const missing = uniqueCodes.filter((c) => !found.has(c));
    throw badRequest("存在未注册的权限码", { missing });
  }

  const afterCodes = uniqueCodes.slice().sort();

  try {
    await db.transaction(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, params.roleId));

      if (permRows.length > 0) {
        await tx.insert(rolePermissions).values(permRows.map((p) => ({ roleId: params.roleId, permissionId: p.id })));
      }
    });

    await writeAuditLog({
      actor: params.actor,
      action: "role.permissions.update",
      targetType: "role",
      targetId: params.roleId,
      success: true,
      reason: params.reason,
      diff: { before: beforeCodes, after: afterCodes },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "role.permissions.update",
      targetType: "role",
      targetId: params.roleId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { before: beforeCodes, after: afterCodes },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}
