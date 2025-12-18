import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/http/errors";
import type { RequestContext } from "@/lib/http/route";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import { writeAuditLog } from "@/lib/modules/audit/audit.service";
import { mergeConfiguredDataScope, type DbScopeType, type ResolvedDataScope } from "./dataPermission.merge";
import { departmentClosure, departments, roleDataScopeDepartments, roleDataScopes, roles, userDepartments, userRoles } from "@campus-hub/db";

type ScopeType = "ALL" | "CUSTOM" | "DEPT" | "DEPT_AND_CHILD" | "SELF" | "NONE";

function assertModuleName(module: string) {
  const ok = /^[a-z][a-z0-9_]*$/.test(module);
  if (!ok) throw badRequest("module 命名仅允许小写字母/数字/下划线，且必须以字母开头");
}

function toDbScopeType(scopeType: ScopeType): DbScopeType {
  return scopeType.toLowerCase() as DbScopeType;
}

function toApiScopeType(scopeType: DbScopeType): ScopeType {
  return scopeType.toUpperCase() as ScopeType;
}

async function getUserRoleCodes(userId: string) {
  const rows = await db
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
    .orderBy(asc(roles.code));
  return rows.map((r) => r.code);
}

async function getUserRoleIds(userId: string) {
  const rows = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.roleId);
}

async function getUserDepartmentIds(userId: string) {
  const rows = await db
    .select({ departmentId: userDepartments.departmentId })
    .from(userDepartments)
    .where(eq(userDepartments.userId, userId));
  return rows.map((r) => r.departmentId);
}

async function expandToDescendants(deptIds: string[]) {
  if (deptIds.length === 0) return [];
  const rows = await db
    .select({ id: departmentClosure.descendantId })
    .from(departmentClosure)
    .where(inArray(departmentClosure.ancestorId, deptIds));
  return [...new Set(rows.map((r) => r.id))];
}

export async function getRoleDataScopes(roleId: string) {
  const roleRow = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!roleRow[0]) throw notFound("角色不存在");

  const scopeRows = await db
    .select({ module: roleDataScopes.module, scopeType: roleDataScopes.scopeType })
    .from(roleDataScopes)
    .where(eq(roleDataScopes.roleId, roleId))
    .orderBy(asc(roleDataScopes.module));

  const customModules = scopeRows.filter((r) => r.scopeType === "custom").map((r) => r.module);

  const deptRows =
    customModules.length === 0
      ? []
      : await db
          .select({ module: roleDataScopeDepartments.module, departmentId: roleDataScopeDepartments.departmentId })
          .from(roleDataScopeDepartments)
          .where(and(eq(roleDataScopeDepartments.roleId, roleId), inArray(roleDataScopeDepartments.module, customModules)));

  const deptMap = new Map<string, string[]>();
  for (const r of deptRows) {
    const list = deptMap.get(r.module) ?? [];
    list.push(r.departmentId);
    deptMap.set(r.module, list);
  }

  return {
    roleId,
    items: scopeRows.map((r) => ({
      module: r.module,
      scopeType: toApiScopeType(r.scopeType),
      departmentIds: deptMap.get(r.module) ?? [],
    })),
  };
}

export async function setRoleDataScopes(params: {
  roleId: string;
  items: Array<{ module: string; scopeType: ScopeType; departmentIds?: string[] }>;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  const roleRow = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, params.roleId)).limit(1);
  if (!roleRow[0]) throw notFound("角色不存在");

  const normalized = params.items.map((i) => ({
    module: i.module.trim(),
    scopeType: i.scopeType,
    departmentIds: i.departmentIds ?? [],
  }));

  for (const item of normalized) assertModuleName(item.module);

  const modules = normalized.map((i) => i.module);
  const uniqueModules = new Set(modules);
  if (uniqueModules.size !== modules.length) throw badRequest("items.module 不允许重复");

  for (const item of normalized) {
    if (item.scopeType === "CUSTOM" && item.departmentIds.length === 0) {
      throw badRequest("CUSTOM 需要提供 departmentIds");
    }
  }

  const before = await getRoleDataScopes(params.roleId);

  const deptIdSet = new Set<string>();
  for (const item of normalized) {
    if (item.scopeType === "CUSTOM") {
      for (const id of item.departmentIds) deptIdSet.add(id);
    }
  }

  if (deptIdSet.size > 0) {
    const ids = [...deptIdSet];
    const rows = await db.select({ id: departments.id }).from(departments).where(inArray(departments.id, ids));
    if (rows.length !== ids.length) {
      const found = new Set(rows.map((r) => r.id));
      const missing = ids.filter((id) => !found.has(id));
      throw badRequest("存在不存在的 departmentId", { missing });
    }
  }

  const nextItems = normalized.map((i) => ({
    module: i.module,
    scopeType: i.scopeType,
    departmentIds: i.scopeType === "CUSTOM" ? i.departmentIds : [],
  }));

  try {
    await db.transaction(async (tx) => {
      await tx.delete(roleDataScopeDepartments).where(eq(roleDataScopeDepartments.roleId, params.roleId));
      await tx.delete(roleDataScopes).where(eq(roleDataScopes.roleId, params.roleId));

      if (normalized.length > 0) {
        await tx.insert(roleDataScopes).values(
          normalized.map((i) => ({
            roleId: params.roleId,
            module: i.module,
            scopeType: toDbScopeType(i.scopeType),
          })),
        );
      }

      const deptValues = normalized.flatMap((i) =>
        i.scopeType === "CUSTOM"
          ? i.departmentIds.map((departmentId) => ({
              roleId: params.roleId,
              module: i.module,
              departmentId,
            }))
          : [],
      );

      if (deptValues.length > 0) await tx.insert(roleDataScopeDepartments).values(deptValues);
    });

    await writeAuditLog({
      actor: params.actor,
      action: "role.data_scopes.update",
      targetType: "role",
      targetId: params.roleId,
      success: true,
      reason: params.reason,
      diff: { before: before.items, after: nextItems },
      request: params.request,
    });

    return getRoleDataScopes(params.roleId);
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "role.data_scopes.update",
      targetType: "role",
      targetId: params.roleId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { before: before.items, after: nextItems },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function resolveMergedScopeForUser(params: { userId: string; module: string }): Promise<ResolvedDataScope> {
  assertModuleName(params.module);

  const roleIds = await getUserRoleIds(params.userId);
  if (roleIds.length === 0) return { scopeType: "SELF" };

  const scopeRows = await db
    .select({ roleId: roleDataScopes.roleId, scopeType: roleDataScopes.scopeType })
    .from(roleDataScopes)
    .where(and(inArray(roleDataScopes.roleId, roleIds), eq(roleDataScopes.module, params.module)));

  if (scopeRows.length === 0) {
    const roleCodes = await getUserRoleCodes(params.userId);
    if (roleCodes.includes("super_admin") || roleCodes.includes("admin")) return { scopeType: "ALL" };
    return { scopeType: "SELF" };
  }

  const scopeTypes = scopeRows.map((r) => r.scopeType);

  let customDepartmentIds: string[] = [];
  if (scopeTypes.includes("custom")) {
    const customRoleIds = scopeRows.filter((r) => r.scopeType === "custom").map((r) => r.roleId);
    if (customRoleIds.length > 0) {
      const deptRows = await db
        .select({ departmentId: roleDataScopeDepartments.departmentId })
        .from(roleDataScopeDepartments)
        .where(and(inArray(roleDataScopeDepartments.roleId, customRoleIds), eq(roleDataScopeDepartments.module, params.module)));
      customDepartmentIds = [...new Set(deptRows.map((r) => r.departmentId))];
    }
  }

  const userDepartmentIds =
    scopeTypes.includes("dept") || scopeTypes.includes("dept_and_child") ? await getUserDepartmentIds(params.userId) : [];

  return mergeConfiguredDataScope({
    scopeTypes,
    customDepartmentIds,
    userDepartmentIds,
    expandToDescendants,
  });
}

export type { ResolvedDataScope };
