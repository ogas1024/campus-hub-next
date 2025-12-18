import "server-only";

import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { badRequest, conflict, forbidden, notFound } from "@/lib/http/errors";
import type { RequestContext } from "@/lib/http/route";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import { writeAuditLog } from "@/lib/modules/audit/audit.service";
import { buildUserIdDataScopeCondition } from "@/lib/modules/data-permission/dataPermission.where";
import { authUsers, departmentClosure, departments, positions, profiles, roles, userDepartments, userPositions, userRoles } from "@campus-hub/db";

type ProfileStatus = "pending_email_verification" | "pending_approval" | "active" | "disabled" | "banned";

function isBanned(bannedUntil: Date | null) {
  if (!bannedUntil) return false;
  return bannedUntil.getTime() > Date.now();
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

async function assertActorCanMutateTarget(params: {
  actorUserId: string;
  targetUserId: string;
  operation: string;
}) {
  if (params.actorUserId === params.targetUserId) {
    if (["user.disable", "user.ban", "user.delete"].includes(params.operation)) {
      throw badRequest("不允许对自己执行该操作");
    }
  }

  const [actorRoleCodes, targetRoleCodes] = await Promise.all([
    getUserRoleCodes(params.actorUserId),
    getUserRoleCodes(params.targetUserId),
  ]);

  const actorIsSuperAdmin = actorRoleCodes.includes("super_admin");
  const targetIsSuperAdmin = targetRoleCodes.includes("super_admin");

  if (targetIsSuperAdmin && !actorIsSuperAdmin && params.actorUserId !== params.targetUserId) {
    throw forbidden("无权限对超级管理员执行该操作");
  }
}

async function getBuiltinUserRoleId() {
  const rows = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, "user")).limit(1);
  const row = rows[0];
  if (!row) throw new Error("缺少内置角色 user（roles.code=user）");
  return row.id;
}

type TableWithId = AnyPgTable & { id: AnyPgColumn };

async function assertIdsExist(params: {
  label: string;
  ids: string[];
  table: TableWithId;
}) {
  if (params.ids.length === 0) return;
  const rows = await db.select({ id: params.table.id }).from(params.table).where(inArray(params.table.id, params.ids));
  if (rows.length !== params.ids.length) {
    const found = new Set(rows.map((r) => String(r.id)));
    const missing = params.ids.filter((id) => !found.has(id));
    throw badRequest(`存在不存在的 ${params.label}`, { missing });
  }
}

async function setUserRolesOverwrite(params: { userId: string; roleIds: string[] }) {
  await db.transaction(async (tx) => {
    await tx.delete(userRoles).where(eq(userRoles.userId, params.userId));
    if (params.roleIds.length > 0) {
      await tx.insert(userRoles).values(params.roleIds.map((roleId) => ({ userId: params.userId, roleId })));
    }
  });
}

async function setUserDepartmentsOverwrite(params: { userId: string; departmentIds: string[] }) {
  await db.transaction(async (tx) => {
    await tx.delete(userDepartments).where(eq(userDepartments.userId, params.userId));
    if (params.departmentIds.length > 0) {
      await tx
        .insert(userDepartments)
        .values(params.departmentIds.map((departmentId) => ({ userId: params.userId, departmentId })));
    }
  });
}

async function setUserPositionsOverwrite(params: { userId: string; positionIds: string[] }) {
  await db.transaction(async (tx) => {
    await tx.delete(userPositions).where(eq(userPositions.userId, params.userId));
    if (params.positionIds.length > 0) {
      await tx.insert(userPositions).values(params.positionIds.map((positionId) => ({ userId: params.userId, positionId })));
    }
  });
}

function computeEffectiveStatus(row: {
  profileStatus: ProfileStatus;
  bannedUntil: Date | null;
  deletedAt: Date | null;
}): ProfileStatus {
  if (row.deletedAt) return "disabled";
  if (isBanned(row.bannedUntil)) return "banned";
  return row.profileStatus;
}

async function buildVisibilityCondition(actorUserId: string) {
  return buildUserIdDataScopeCondition({ actorUserId, module: "user", targetUserIdColumn: profiles.id });
}

export async function listConsoleUsers(params: {
  actorUserId: string;
  page: number;
  pageSize: number;
  q?: string;
  status?: ProfileStatus;
  roleId?: string;
  departmentId?: string;
  positionId?: string;
  sortBy: "createdAt" | "updatedAt" | "lastLoginAt";
  sortOrder: "asc" | "desc";
}) {
  const { condition: visibilityCondition } = await buildVisibilityCondition(params.actorUserId);

  const where = [visibilityCondition].filter(Boolean);

  if (params.status) {
    if (params.status === "banned") {
      where.push(or(eq(profiles.status, "banned"), and(sql`${authUsers.bannedUntil} is not null`, sql`${authUsers.bannedUntil} > now()`))!);
    } else {
      where.push(eq(profiles.status, params.status));
      where.push(or(sql`${authUsers.bannedUntil} is null`, sql`${authUsers.bannedUntil} <= now()`)!);
    }
  }

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    where.push(
      or(
        sql`${profiles.name} ilike ${pattern}`,
        sql`${profiles.studentId} ilike ${pattern}`,
        sql`${authUsers.email} ilike ${pattern}`,
      )!,
    );
  }

  if (params.roleId) {
    const sub = db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.roleId, params.roleId));
    where.push(inArray(profiles.id, sub));
  }

  if (params.positionId) {
    const sub = db
      .select({ userId: userPositions.userId })
      .from(userPositions)
      .where(eq(userPositions.positionId, params.positionId));
    where.push(inArray(profiles.id, sub));
  }

  if (params.departmentId) {
    const sub = db
      .select({ userId: userDepartments.userId })
      .from(userDepartments)
      .innerJoin(departmentClosure, eq(departmentClosure.descendantId, userDepartments.departmentId))
      .where(eq(departmentClosure.ancestorId, params.departmentId));
    where.push(inArray(profiles.id, sub));
  }

  const offset = (params.page - 1) * params.pageSize;

  const sortCol =
    params.sortBy === "updatedAt" ? profiles.updatedAt : params.sortBy === "lastLoginAt" ? profiles.lastLoginAt : profiles.createdAt;
  const orderExpr = params.sortOrder === "asc" ? asc(sortCol) : desc(sortCol);

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(profiles)
    .innerJoin(authUsers, eq(authUsers.id, profiles.id))
    .where(and(...where));

  const rows = await db
    .select({
      id: profiles.id,
      email: authUsers.email,
      emailConfirmedAt: authUsers.emailConfirmedAt,
      bannedUntil: authUsers.bannedUntil,
      deletedAt: authUsers.deletedAt,
      name: profiles.name,
      studentId: profiles.studentId,
      status: profiles.status,
      createdAt: profiles.createdAt,
      updatedAt: profiles.updatedAt,
      lastLoginAt: profiles.lastLoginAt,
    })
    .from(profiles)
    .innerJoin(authUsers, eq(authUsers.id, profiles.id))
    .where(and(...where))
    .orderBy(orderExpr, desc(profiles.createdAt), desc(profiles.id))
    .limit(params.pageSize)
    .offset(offset);

  const userIds = rows.map((r) => r.id);

  const [roleRows, deptRows, posRows] = await Promise.all([
    userIds.length === 0
      ? []
      : db.select({ userId: userRoles.userId, roleId: userRoles.roleId }).from(userRoles).where(inArray(userRoles.userId, userIds)),
    userIds.length === 0
      ? []
      : db
          .select({ userId: userDepartments.userId, departmentId: userDepartments.departmentId })
          .from(userDepartments)
          .where(inArray(userDepartments.userId, userIds)),
    userIds.length === 0
      ? []
      : db
          .select({ userId: userPositions.userId, positionId: userPositions.positionId })
          .from(userPositions)
          .where(inArray(userPositions.userId, userIds)),
  ]);

  const roleMap = new Map<string, string[]>();
  for (const r of roleRows) roleMap.set(r.userId, [...(roleMap.get(r.userId) ?? []), r.roleId]);
  const deptMap = new Map<string, string[]>();
  for (const r of deptRows) deptMap.set(r.userId, [...(deptMap.get(r.userId) ?? []), r.departmentId]);
  const posMap = new Map<string, string[]>();
  for (const r of posRows) posMap.set(r.userId, [...(posMap.get(r.userId) ?? []), r.positionId]);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => {
      const status = computeEffectiveStatus({
        profileStatus: r.status as ProfileStatus,
        bannedUntil: r.bannedUntil,
        deletedAt: r.deletedAt,
      });

      return {
        id: r.id,
        email: r.email ?? null,
        emailVerified: !!r.emailConfirmedAt,
        name: r.name,
        studentId: r.studentId,
        status,
        roleIds: roleMap.get(r.id) ?? [],
        departmentIds: deptMap.get(r.id) ?? [],
        positionIds: posMap.get(r.id) ?? [],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        lastLoginAt: r.lastLoginAt,
      };
    }),
  };
}

export async function getConsoleUserDetail(params: { actorUserId: string; userId: string }) {
  const { condition: visibilityCondition } = await buildVisibilityCondition(params.actorUserId);

  const rows = await db
    .select({
      id: profiles.id,
      profileStatus: profiles.status,
      name: profiles.name,
      username: profiles.username,
      studentId: profiles.studentId,
      avatarUrl: profiles.avatarUrl,
      createdAt: profiles.createdAt,
      updatedAt: profiles.updatedAt,
      lastLoginAt: profiles.lastLoginAt,
      email: authUsers.email,
      emailConfirmedAt: authUsers.emailConfirmedAt,
      authCreatedAt: authUsers.createdAt,
      lastSignInAt: authUsers.lastSignInAt,
      bannedUntil: authUsers.bannedUntil,
      deletedAt: authUsers.deletedAt,
    })
    .from(profiles)
    .innerJoin(authUsers, eq(authUsers.id, profiles.id))
    .where(and(eq(profiles.id, params.userId), visibilityCondition))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound();

  const [roleRows, deptRows, posRows] = await Promise.all([
    db
      .select({ id: roles.id, code: roles.code, name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, params.userId))
      .orderBy(asc(roles.code)),
    db
      .select({ id: departments.id, name: departments.name, parentId: departments.parentId })
      .from(userDepartments)
      .innerJoin(departments, eq(userDepartments.departmentId, departments.id))
      .where(eq(userDepartments.userId, params.userId))
      .orderBy(asc(departments.sort), asc(departments.name)),
    db
      .select({ id: positions.id, name: positions.name })
      .from(userPositions)
      .innerJoin(positions, eq(userPositions.positionId, positions.id))
      .where(eq(userPositions.userId, params.userId))
      .orderBy(asc(positions.sort), asc(positions.name)),
  ]);

  const effectiveStatus = computeEffectiveStatus({
    profileStatus: row.profileStatus as ProfileStatus,
    bannedUntil: row.bannedUntil,
    deletedAt: row.deletedAt,
  });

  return {
    id: row.id,
    email: row.email ?? null,
    emailVerified: !!row.emailConfirmedAt,
    auth: {
      createdAt: row.authCreatedAt,
      lastSignInAt: row.lastSignInAt,
      bannedUntil: row.bannedUntil,
      deletedAt: row.deletedAt,
    },
    profile: {
      name: row.name,
      username: row.username,
      studentId: row.studentId,
      avatarUrl: row.avatarUrl,
      status: effectiveStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastLoginAt: row.lastLoginAt,
    },
    roles: roleRows,
    departments: deptRows,
    positions: posRows,
  };
}

export async function createConsoleUser(params: {
  email: string;
  password?: string;
  emailConfirm: boolean;
  name: string;
  studentId: string;
  roleIds: string[];
  departmentIds: string[];
  positionIds: string[];
  actor: AuditActor;
  request: RequestContext;
}) {
  const supabase = createSupabaseAdminClient();

  const builtinUserRoleId = await getBuiltinUserRoleId();
  const roleIdSet = new Set(params.roleIds);
  roleIdSet.add(builtinUserRoleId);
  const finalRoleIds = [...roleIdSet];

  await assertIdsExist({ label: "roleId", ids: finalRoleIds, table: roles });
  await assertIdsExist({ label: "departmentId", ids: params.departmentIds, table: departments });
  await assertIdsExist({ label: "positionId", ids: params.positionIds, table: positions });

  const action = params.password ? "user.create" : "user.invite";
  let createdUserId: string | null = null;

  try {
    if (params.password) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: params.email,
        password: params.password,
        email_confirm: params.emailConfirm,
        user_metadata: { name: params.name, studentId: params.studentId },
      });
      if (error || !data.user) throw badRequest("创建用户失败", { message: error?.message });
      createdUserId = data.user.id;
    } else {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(params.email, {
        data: { name: params.name, studentId: params.studentId },
      });
      if (error || !data.user) throw badRequest("邀请用户失败", { message: error?.message });
      createdUserId = data.user.id;
    }

    await db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, createdUserId!));
      await tx.insert(userRoles).values(finalRoleIds.map((roleId) => ({ userId: createdUserId!, roleId })));

      await tx.delete(userDepartments).where(eq(userDepartments.userId, createdUserId!));
      if (params.departmentIds.length > 0) {
        await tx
          .insert(userDepartments)
          .values(params.departmentIds.map((departmentId) => ({ userId: createdUserId!, departmentId })));
      }

      await tx.delete(userPositions).where(eq(userPositions.userId, createdUserId!));
      if (params.positionIds.length > 0) {
        await tx.insert(userPositions).values(params.positionIds.map((positionId) => ({ userId: createdUserId!, positionId })));
      }
    });

    await writeAuditLog({
      actor: params.actor,
      action,
      targetType: "user",
      targetId: createdUserId!,
      success: true,
      diff: {
        email: params.email,
        emailConfirm: params.emailConfirm,
        name: params.name,
        studentId: params.studentId,
        roleIds: finalRoleIds,
        departmentIds: params.departmentIds,
        positionIds: params.positionIds,
      },
      request: params.request,
    });

    return getConsoleUserDetail({ actorUserId: params.actor.userId, userId: createdUserId! });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action,
      targetType: "user",
      targetId: createdUserId ?? "new",
      success: false,
      errorCode: "INTERNAL_ERROR",
      diff: { email: params.email, name: params.name, studentId: params.studentId },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function inviteConsoleUser(params: {
  email: string;
  redirectTo?: string;
  name: string;
  studentId: string;
  roleIds: string[];
  departmentIds: string[];
  positionIds: string[];
  actor: AuditActor;
  request: RequestContext;
}) {
  const supabase = createSupabaseAdminClient();

  const builtinUserRoleId = await getBuiltinUserRoleId();
  const roleIdSet = new Set(params.roleIds);
  roleIdSet.add(builtinUserRoleId);
  const finalRoleIds = [...roleIdSet];

  await assertIdsExist({ label: "roleId", ids: finalRoleIds, table: roles });
  await assertIdsExist({ label: "departmentId", ids: params.departmentIds, table: departments });
  await assertIdsExist({ label: "positionId", ids: params.positionIds, table: positions });

  let createdUserId: string | null = null;

  try {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(params.email, {
      data: { name: params.name, studentId: params.studentId },
      redirectTo: params.redirectTo,
    });
    if (error || !data.user) throw badRequest("邀请用户失败", { message: error?.message });
    createdUserId = data.user.id;

    await db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, createdUserId!));
      await tx.insert(userRoles).values(finalRoleIds.map((roleId) => ({ userId: createdUserId!, roleId })));

      await tx.delete(userDepartments).where(eq(userDepartments.userId, createdUserId!));
      if (params.departmentIds.length > 0) {
        await tx
          .insert(userDepartments)
          .values(params.departmentIds.map((departmentId) => ({ userId: createdUserId!, departmentId })));
      }

      await tx.delete(userPositions).where(eq(userPositions.userId, createdUserId!));
      if (params.positionIds.length > 0) {
        await tx.insert(userPositions).values(params.positionIds.map((positionId) => ({ userId: createdUserId!, positionId })));
      }
    });

    await writeAuditLog({
      actor: params.actor,
      action: "user.invite",
      targetType: "user",
      targetId: createdUserId,
      success: true,
      diff: {
        email: params.email,
        redirectTo: params.redirectTo ?? null,
        name: params.name,
        studentId: params.studentId,
        roleIds: finalRoleIds,
        departmentIds: params.departmentIds,
        positionIds: params.positionIds,
      },
      request: params.request,
    });

    return { userId: createdUserId };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "user.invite",
      targetType: "user",
      targetId: createdUserId ?? "new",
      success: false,
      errorCode: "INTERNAL_ERROR",
      diff: { email: params.email, name: params.name, studentId: params.studentId },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function approveUser(params: { userId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  await assertActorCanMutateTarget({ actorUserId: params.actor.userId, targetUserId: params.userId, operation: "user.approve" });

  const rows = await db
    .select({ status: profiles.status })
    .from(profiles)
    .where(eq(profiles.id, params.userId))
    .limit(1);

  const current = rows[0];
  if (!current) throw notFound("用户不存在");

  if (current.status === "active") return { ok: true };
  if (current.status !== "pending_approval") throw conflict("仅待审核用户允许通过");

  try {
    await db.update(profiles).set({ status: "active" }).where(eq(profiles.id, params.userId));

    await writeAuditLog({
      actor: params.actor,
      action: "user.approve",
      targetType: "user",
      targetId: params.userId,
      success: true,
      reason: params.reason,
      diff: { before: current.status, after: "active" },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "user.approve",
      targetType: "user",
      targetId: params.userId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { before: current.status, after: "active" },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function rejectUser(params: { userId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  await assertActorCanMutateTarget({ actorUserId: params.actor.userId, targetUserId: params.userId, operation: "user.reject" });

  const rows = await db
    .select({ status: profiles.status })
    .from(profiles)
    .where(eq(profiles.id, params.userId))
    .limit(1);

  const current = rows[0];
  if (!current) throw notFound("用户不存在");

  if (current.status === "disabled") return { ok: true };
  if (current.status !== "pending_approval") throw conflict("仅待审核用户允许拒绝");

  try {
    await db.update(profiles).set({ status: "disabled" }).where(eq(profiles.id, params.userId));

    await writeAuditLog({
      actor: params.actor,
      action: "user.reject",
      targetType: "user",
      targetId: params.userId,
      success: true,
      reason: params.reason,
      diff: { before: current.status, after: "disabled" },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "user.reject",
      targetType: "user",
      targetId: params.userId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { before: current.status, after: "disabled" },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function disableUser(params: { userId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  await assertActorCanMutateTarget({ actorUserId: params.actor.userId, targetUserId: params.userId, operation: "user.disable" });

  const rows = await db
    .select({ status: profiles.status })
    .from(profiles)
    .where(eq(profiles.id, params.userId))
    .limit(1);

  const current = rows[0];
  if (!current) throw notFound("用户不存在");
  if (current.status === "disabled") return { ok: true };

  try {
    await db.update(profiles).set({ status: "disabled" }).where(eq(profiles.id, params.userId));

    await writeAuditLog({
      actor: params.actor,
      action: "user.disable",
      targetType: "user",
      targetId: params.userId,
      success: true,
      reason: params.reason,
      diff: { before: current.status, after: "disabled" },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "user.disable",
      targetType: "user",
      targetId: params.userId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { before: current.status, after: "disabled" },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function enableUser(params: { userId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  await assertActorCanMutateTarget({ actorUserId: params.actor.userId, targetUserId: params.userId, operation: "user.enable" });

  const rows = await db
    .select({ status: profiles.status, emailConfirmedAt: authUsers.emailConfirmedAt, bannedUntil: authUsers.bannedUntil, deletedAt: authUsers.deletedAt })
    .from(profiles)
    .innerJoin(authUsers, eq(authUsers.id, profiles.id))
    .where(eq(profiles.id, params.userId))
    .limit(1);

  const current = rows[0];
  if (!current) throw notFound("用户不存在");
  if (current.status === "active") return { ok: true };
  if (current.status !== "disabled") throw conflict("仅已停用用户允许启用");
  if (!current.emailConfirmedAt) throw conflict("用户邮箱未验证，禁止启用");
  if (current.deletedAt) throw conflict("用户已删除，禁止启用");
  if (isBanned(current.bannedUntil)) throw conflict("用户已封禁，禁止启用");

  try {
    await db.update(profiles).set({ status: "active" }).where(eq(profiles.id, params.userId));

    await writeAuditLog({
      actor: params.actor,
      action: "user.enable",
      targetType: "user",
      targetId: params.userId,
      success: true,
      reason: params.reason,
      diff: { before: current.status, after: "active" },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "user.enable",
      targetType: "user",
      targetId: params.userId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { before: current.status, after: "active" },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function banUser(params: {
  userId: string;
  duration: string;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  if (params.duration === "none") throw badRequest("封禁 duration 不允许为 none");
  await assertActorCanMutateTarget({ actorUserId: params.actor.userId, targetUserId: params.userId, operation: "user.ban" });

  const supabase = createSupabaseAdminClient();

  try {
    const { data, error } = await supabase.auth.admin.updateUserById(params.userId, { ban_duration: params.duration });
    if (error || !data.user) throw badRequest("封禁失败", { message: error?.message });

    await writeAuditLog({
      actor: params.actor,
      action: "user.ban",
      targetType: "user",
      targetId: params.userId,
      success: true,
      reason: params.reason,
      diff: { banDuration: params.duration },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "user.ban",
      targetType: "user",
      targetId: params.userId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { banDuration: params.duration },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function unbanUser(params: { userId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  await assertActorCanMutateTarget({ actorUserId: params.actor.userId, targetUserId: params.userId, operation: "user.unban" });

  const supabase = createSupabaseAdminClient();

  try {
    const { data, error } = await supabase.auth.admin.updateUserById(params.userId, { ban_duration: "none" });
    if (error || !data.user) throw badRequest("解封失败", { message: error?.message });

    await writeAuditLog({
      actor: params.actor,
      action: "user.unban",
      targetType: "user",
      targetId: params.userId,
      success: true,
      reason: params.reason,
      diff: null,
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "user.unban",
      targetType: "user",
      targetId: params.userId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: null,
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function deleteUser(params: { userId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  await assertActorCanMutateTarget({ actorUserId: params.actor.userId, targetUserId: params.userId, operation: "user.delete" });

  const supabase = createSupabaseAdminClient();

  try {
    const { data, error } = await supabase.auth.admin.deleteUser(params.userId, true);
    if (error || !data.user) throw badRequest("删除失败", { message: error?.message });

    await writeAuditLog({
      actor: params.actor,
      action: "user.delete",
      targetType: "user",
      targetId: params.userId,
      success: true,
      reason: params.reason,
      diff: { soft: true },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "user.delete",
      targetType: "user",
      targetId: params.userId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { soft: true },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function setUserRoles(params: {
  userId: string;
  roleIds: string[];
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  await assertActorCanMutateTarget({ actorUserId: params.actor.userId, targetUserId: params.userId, operation: "user.roles.update" });

  const builtinUserRoleId = await getBuiltinUserRoleId();
  const roleIdSet = new Set(params.roleIds);
  roleIdSet.add(builtinUserRoleId);
  const finalRoleIds = [...roleIdSet];

  await assertIdsExist({ label: "roleId", ids: finalRoleIds, table: roles });

  const beforeRows = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, params.userId));
  const before = beforeRows.map((r) => r.roleId).sort();
  const after = finalRoleIds.slice().sort();

  try {
    await setUserRolesOverwrite({ userId: params.userId, roleIds: finalRoleIds });

    await writeAuditLog({
      actor: params.actor,
      action: "user.roles.update",
      targetType: "user",
      targetId: params.userId,
      success: true,
      reason: params.reason,
      diff: { before, after },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "user.roles.update",
      targetType: "user",
      targetId: params.userId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { before, after },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function setUserDepartments(params: {
  userId: string;
  departmentIds: string[];
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  await assertActorCanMutateTarget({ actorUserId: params.actor.userId, targetUserId: params.userId, operation: "user.departments.update" });
  await assertIdsExist({ label: "departmentId", ids: params.departmentIds, table: departments });

  const beforeRows = await db
    .select({ departmentId: userDepartments.departmentId })
    .from(userDepartments)
    .where(eq(userDepartments.userId, params.userId));
  const before = beforeRows.map((r) => r.departmentId).sort();
  const after = params.departmentIds.slice().sort();

  try {
    await setUserDepartmentsOverwrite({ userId: params.userId, departmentIds: params.departmentIds });

    await writeAuditLog({
      actor: params.actor,
      action: "user.departments.update",
      targetType: "user",
      targetId: params.userId,
      success: true,
      reason: params.reason,
      diff: { before, after },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "user.departments.update",
      targetType: "user",
      targetId: params.userId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { before, after },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function setUserPositions(params: {
  userId: string;
  positionIds: string[];
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  await assertActorCanMutateTarget({ actorUserId: params.actor.userId, targetUserId: params.userId, operation: "user.positions.update" });
  await assertIdsExist({ label: "positionId", ids: params.positionIds, table: positions });

  const beforeRows = await db
    .select({ positionId: userPositions.positionId })
    .from(userPositions)
    .where(eq(userPositions.userId, params.userId));
  const before = beforeRows.map((r) => r.positionId).sort();
  const after = params.positionIds.slice().sort();

  try {
    await setUserPositionsOverwrite({ userId: params.userId, positionIds: params.positionIds });

    await writeAuditLog({
      actor: params.actor,
      action: "user.positions.update",
      targetType: "user",
      targetId: params.userId,
      success: true,
      reason: params.reason,
      diff: { before, after },
      request: params.request,
    });

    return { ok: true };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "user.positions.update",
      targetType: "user",
      targetId: params.userId,
      success: false,
      errorCode: "INTERNAL_ERROR",
      reason: params.reason,
      diff: { before, after },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}
