import "server-only";

import { Readable } from "node:stream";

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { hasPerm } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { badRequest, conflict, forbidden, HttpError, notFound } from "@/lib/http/errors";
import type { RequestContext } from "@/lib/http/route";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import { writeAuditLog } from "@/lib/modules/audit/audit.service";
import { buildVisibilityCondition, getAudienceContext, getVisibleIdsForUser } from "@/lib/modules/content-visibility/contentVisibility";
import { getVisibilityScopeOptions } from "@/lib/modules/content-visibility/scopeOptions";
import { buildUserIdDataScopeCondition } from "@/lib/modules/data-permission/dataPermission.where";
import { storageAdapter } from "@/lib/storage";
import { sanitizeStorageObjectKeyPart } from "@/lib/utils/fileName";
import {
  collectItems,
  collectSubmissionFiles,
  collectSubmissions,
  collectTaskScopes,
  collectTasks,
  departments,
  departmentClosure,
  notices,
  noticeScopes,
  profiles,
  userDepartments,
} from "@campus-hub/db";

import { buildManifestCsv, buildZipPath } from "./collect.export";
import type { CollectModuleConfig, CollectScopeInput, CollectSource, CollectSubmissionStatus, CollectTaskStatus } from "./collect.types";

const SIGNED_URL_EXPIRES_IN = 60;

const MAX_TEMPLATE_BYTES = 20 * 1024 * 1024;
const MAX_SUBMISSION_FILE_BYTES = 200 * 1024 * 1024;
const MAX_EXPORT_ZIP_BYTES = 1024 * 1024 * 1024; // 1GB（MVP 兜底；超出需缩小过滤范围）

function perm(module: string, op: string) {
  return `campus:${module}:${op}`;
}

function toErrorCode(err: unknown) {
  return err instanceof HttpError ? err.code : "INTERNAL_ERROR";
}

function safeContentType(file: File | Blob) {
  const raw = (file as { type?: string } | null)?.type ?? "";
  return raw && raw.trim() ? raw : "application/octet-stream";
}

function toStorageError(err: unknown) {
  const e = err as { message?: string } | null;
  return e?.message ? String(e.message) : "未知错误";
}

function assertValidSource(module: string, source: CollectSource | null) {
  if (!source) return;
  if (source.type !== "notice") throw badRequest(`不支持的 source.type：${source.type}`);
  if (!source.id || !source.id.trim()) throw badRequest("source.id 不能为空");
  if (!/^[a-z][a-z0-9]*$/.test(module)) throw badRequest("module 不合法");
}

async function canManageAllTasks(userId: string, module: string) {
  return hasPerm(userId, perm(module, "manage"));
}

async function getTaskBaseForConsole(params: { module: string; actorUserId: string; taskId: string }) {
  const { condition: visibilityCondition } = await buildUserIdDataScopeCondition({
    actorUserId: params.actorUserId,
    module: params.module,
    targetUserIdColumn: collectTasks.createdBy,
  });

  const rows = await db
    .select({
      id: collectTasks.id,
      module: collectTasks.module,
      title: collectTasks.title,
      descriptionMd: collectTasks.descriptionMd,
      status: collectTasks.status,
      sourceType: collectTasks.sourceType,
      sourceId: collectTasks.sourceId,
      visibleAll: collectTasks.visibleAll,
      maxFilesPerSubmission: collectTasks.maxFilesPerSubmission,
      dueAt: collectTasks.dueAt,
      createdBy: collectTasks.createdBy,
      archivedAt: collectTasks.archivedAt,
      createdAt: collectTasks.createdAt,
      updatedAt: collectTasks.updatedAt,
      deletedAt: collectTasks.deletedAt,
    })
    .from(collectTasks)
    .where(and(eq(collectTasks.id, params.taskId), eq(collectTasks.module, params.module), isNull(collectTasks.deletedAt), visibilityCondition ?? sql`true`))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound();

  return row as {
    id: string;
    module: string;
    title: string;
    descriptionMd: string;
    status: CollectTaskStatus;
    sourceType: "notice" | null;
    sourceId: string | null;
    visibleAll: boolean;
    maxFilesPerSubmission: number;
    dueAt: Date | null;
    createdBy: string;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  };
}

async function assertCanOperateTask(params: { module: string; actorUserId: string; taskId: string }) {
  const row = await getTaskBaseForConsole(params);
  if (row.createdBy === params.actorUserId) return row;
  if (await canManageAllTasks(params.actorUserId, params.module)) return row;
  throw forbidden("只能操作自己创建的收集任务");
}

async function getSourceMeta(source: { type: "notice"; id: string }) {
  const rows = await db
    .select({ id: notices.id, title: notices.title })
    .from(notices)
    .where(and(eq(notices.id, source.id), isNull(notices.deletedAt)))
    .limit(1);
  if (!rows[0]) throw badRequest("关联的通知公告不存在或已删除");
  return { type: "notice" as const, id: rows[0].id, title: rows[0].title };
}

async function assertUniqueSourceBinding(params: { module: string; source: { type: "notice"; id: string }; excludeTaskId?: string }) {
  const where = [
    eq(collectTasks.module, params.module),
    eq(collectTasks.sourceType, params.source.type),
    eq(collectTasks.sourceId, params.source.id),
    isNull(collectTasks.deletedAt),
  ];
  if (params.excludeTaskId) where.push(sql`${collectTasks.id} <> ${params.excludeTaskId}`);

  const rows = await db
    .select({ id: collectTasks.id })
    .from(collectTasks)
    .where(and(...where))
    .limit(1);
  if (rows[0]) throw conflict("该来源对象已关联收集任务");
}

export async function getCollectScopeOptions() {
  return getVisibilityScopeOptions();
}

export async function listConsoleCollectTasks(params: {
  config: CollectModuleConfig;
  actorUserId: string;
  page: number;
  pageSize: number;
  q?: string;
  status?: CollectTaskStatus;
  mine: boolean;
  archived: boolean;
}) {
  const { condition: visibilityCondition } = await buildUserIdDataScopeCondition({
    actorUserId: params.actorUserId,
    module: params.config.module,
    targetUserIdColumn: collectTasks.createdBy,
  });

  const where = [eq(collectTasks.module, params.config.module), isNull(collectTasks.deletedAt)];
  if (visibilityCondition) where.push(visibilityCondition);
  if (params.mine) where.push(eq(collectTasks.createdBy, params.actorUserId));
  if (params.status) where.push(eq(collectTasks.status, params.status));
  where.push(params.archived ? sql`${collectTasks.archivedAt} is not null` : sql`${collectTasks.archivedAt} is null`);

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    where.push(sql`${collectTasks.title} ilike ${pattern}`);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(collectTasks)
    .where(and(...where));

  const rows = await db
    .select({
      id: collectTasks.id,
      title: collectTasks.title,
      status: collectTasks.status,
      sourceType: collectTasks.sourceType,
      sourceId: collectTasks.sourceId,
      visibleAll: collectTasks.visibleAll,
      maxFilesPerSubmission: collectTasks.maxFilesPerSubmission,
      dueAt: collectTasks.dueAt,
      createdBy: collectTasks.createdBy,
      archivedAt: collectTasks.archivedAt,
      createdAt: collectTasks.createdAt,
      updatedAt: collectTasks.updatedAt,
    })
    .from(collectTasks)
    .where(and(...where))
    .orderBy(desc(collectTasks.updatedAt), desc(collectTasks.id))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status as CollectTaskStatus,
      source: r.sourceType && r.sourceId ? ({ type: r.sourceType as "notice", id: r.sourceId } satisfies CollectSource) : null,
      visibleAll: r.visibleAll,
      maxFilesPerSubmission: r.maxFilesPerSubmission,
      dueAt: r.dueAt,
      createdBy: r.createdBy,
      archivedAt: r.archivedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };
}

export async function countConsolePublishedCollectTasksDueSoon(params: { config: CollectModuleConfig; actorUserId: string; withinDays: number }) {
  const withinDays = Math.max(1, Math.min(365, Math.floor(params.withinDays)));
  const now = new Date();
  const to = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const { condition: visibilityCondition } = await buildUserIdDataScopeCondition({
    actorUserId: params.actorUserId,
    module: params.config.module,
    targetUserIdColumn: collectTasks.createdBy,
  });

  const where = [
    eq(collectTasks.module, params.config.module),
    isNull(collectTasks.deletedAt),
    sql`${collectTasks.archivedAt} is null`,
    eq(collectTasks.status, "published"),
    sql`${collectTasks.dueAt} is not null`,
    sql`${collectTasks.dueAt} > ${now.toISOString()}`,
    sql`${collectTasks.dueAt} <= ${to.toISOString()}`,
  ];
  if (visibilityCondition) where.push(visibilityCondition);

  const row = await db
    .select({ total: sql<number>`count(*)` })
    .from(collectTasks)
    .where(and(...where));

  return Number(row[0]?.total ?? 0);
}

export async function listConsolePublishedCollectTasksDueSoon(params: {
  config: CollectModuleConfig;
  actorUserId: string;
  withinDays: number;
  limit: number;
}) {
  const withinDays = Math.max(1, Math.min(365, Math.floor(params.withinDays)));
  const limit = Math.max(1, Math.min(100, Math.floor(params.limit)));
  const now = new Date();
  const to = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const { condition: visibilityCondition } = await buildUserIdDataScopeCondition({
    actorUserId: params.actorUserId,
    module: params.config.module,
    targetUserIdColumn: collectTasks.createdBy,
  });

  const where = [
    eq(collectTasks.module, params.config.module),
    isNull(collectTasks.deletedAt),
    sql`${collectTasks.archivedAt} is null`,
    eq(collectTasks.status, "published"),
    sql`${collectTasks.dueAt} is not null`,
    sql`${collectTasks.dueAt} > ${now.toISOString()}`,
    sql`${collectTasks.dueAt} <= ${to.toISOString()}`,
  ];
  if (visibilityCondition) where.push(visibilityCondition);

  const rows = await db
    .select({
      id: collectTasks.id,
      title: collectTasks.title,
      dueAt: collectTasks.dueAt,
      updatedAt: collectTasks.updatedAt,
    })
    .from(collectTasks)
    .where(and(...where))
    .orderBy(asc(collectTasks.dueAt), desc(collectTasks.updatedAt), desc(collectTasks.id))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    dueAt: r.dueAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getConsoleCollectTaskDetail(params: { config: CollectModuleConfig; actorUserId: string; taskId: string }) {
  const task = await getTaskBaseForConsole({ module: params.config.module, actorUserId: params.actorUserId, taskId: params.taskId });

  const source = task.sourceType && task.sourceId ? ({ type: task.sourceType, id: task.sourceId } satisfies CollectSource) : null;

  const [scopeRows, itemRows, sourceMeta] = await Promise.all([
    source
      ? Promise.resolve([])
      : db
          .select({ scopeType: collectTaskScopes.scopeType, refId: collectTaskScopes.refId })
          .from(collectTaskScopes)
          .where(eq(collectTaskScopes.taskId, task.id))
          .orderBy(asc(collectTaskScopes.scopeType), asc(collectTaskScopes.createdAt)),
    db
      .select({
        id: collectItems.id,
        kind: collectItems.kind,
        title: collectItems.title,
        description: collectItems.description,
        required: collectItems.required,
        sort: collectItems.sort,
        templateFileKey: collectItems.templateFileKey,
        templateFileName: collectItems.templateFileName,
        templateContentType: collectItems.templateContentType,
        templateSize: collectItems.templateSize,
        createdAt: collectItems.createdAt,
        updatedAt: collectItems.updatedAt,
      })
      .from(collectItems)
      .where(eq(collectItems.taskId, task.id))
      .orderBy(asc(collectItems.sort), asc(collectItems.createdAt)),
    source && source.type === "notice" ? getSourceMeta(source) : Promise.resolve(null),
  ]);

  return {
    id: task.id,
    module: task.module,
    title: task.title,
    descriptionMd: task.descriptionMd,
    status: task.status,
    source,
    sourceMeta,
    visibleAll: task.visibleAll,
    scopes: scopeRows,
    maxFilesPerSubmission: task.maxFilesPerSubmission,
    dueAt: task.dueAt,
    archivedAt: task.archivedAt,
    createdBy: task.createdBy,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    items: itemRows.map((i) => ({
      id: i.id,
      kind: i.kind as "file",
      title: i.title,
      description: i.description,
      required: i.required,
      sort: i.sort,
      template:
        i.templateFileKey && i.templateFileName && i.templateContentType && typeof i.templateSize === "number"
          ? {
              fileKey: i.templateFileKey,
              fileName: i.templateFileName,
              contentType: i.templateContentType,
              size: i.templateSize,
            }
          : null,
    })),
  };
}

export async function findConsoleCollectTaskBySource(params: { config: CollectModuleConfig; actorUserId: string; source: CollectSource }) {
  assertValidSource(params.config.module, params.source);

  const { condition: visibilityCondition } = await buildUserIdDataScopeCondition({
    actorUserId: params.actorUserId,
    module: params.config.module,
    targetUserIdColumn: collectTasks.createdBy,
  });

  const where = [
    eq(collectTasks.module, params.config.module),
    isNull(collectTasks.deletedAt),
    eq(collectTasks.sourceType, params.source.type),
    eq(collectTasks.sourceId, params.source.id),
  ];
  if (visibilityCondition) where.push(visibilityCondition);

  const rows = await db
    .select({
      id: collectTasks.id,
      title: collectTasks.title,
      status: collectTasks.status,
      dueAt: collectTasks.dueAt,
      archivedAt: collectTasks.archivedAt,
      createdBy: collectTasks.createdBy,
      updatedAt: collectTasks.updatedAt,
    })
    .from(collectTasks)
    .where(and(...where))
    .limit(1);

  const task = rows[0];
  if (!task) return null;
  return {
    id: task.id,
    title: task.title,
    status: task.status as CollectTaskStatus,
    dueAt: task.dueAt as Date | null,
    archivedAt: task.archivedAt as Date | null,
    createdBy: task.createdBy,
    updatedAt: task.updatedAt as Date,
  };
}

export async function createCollectTaskDraft(params: {
  config: CollectModuleConfig;
  actorUserId: string;
  body: {
    title: string;
    descriptionMd: string;
    source: CollectSource | null;
    visibleAll: boolean;
    scopes: CollectScopeInput[];
    maxFilesPerSubmission: number;
    dueAt: Date | null;
    items: Array<{ id: string; title: string; description: string | null; required: boolean; sort: number }>;
  };
  actor: AuditActor;
  request: RequestContext;
}) {
  const ok = await hasPerm(params.actorUserId, perm(params.config.module, "create"));
  if (!ok) throw forbidden();

  assertValidSource(params.config.module, params.body.source);

  const now = new Date();
  const source = params.body.source;

  if (source && source.type === "notice") {
    await getSourceMeta(source);
    await assertUniqueSourceBinding({ module: params.config.module, source });
  }

  const visibleAll = source ? true : params.body.visibleAll;
  const scopes = source ? [] : params.body.scopes;
  if (!source && visibleAll === false && scopes.length === 0) throw badRequest("可见范围不能为空");

  let taskId: string | null = null;

  try {
    taskId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(collectTasks)
        .values({
          module: params.config.module,
          title: params.body.title,
          descriptionMd: params.body.descriptionMd,
          status: "draft",
          sourceType: source?.type ?? null,
          sourceId: source?.id ?? null,
          visibleAll,
          maxFilesPerSubmission: params.body.maxFilesPerSubmission,
          dueAt: params.body.dueAt ?? null,
          createdBy: params.actorUserId,
          updatedBy: params.actorUserId,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: collectTasks.id });

      const createdId = inserted[0]?.id;
      if (!createdId) throw badRequest("创建收集任务失败");

      if (!source && scopes.length > 0) {
        await tx
          .insert(collectTaskScopes)
          .values(scopes.map((s) => ({ taskId: createdId, scopeType: s.scopeType, refId: s.refId, createdAt: now })));
      }

      if (params.body.items.length > 0) {
        await tx.insert(collectItems).values(
          params.body.items.map((i) => ({
            id: i.id,
            taskId: createdId,
            kind: "file" as const,
            title: i.title,
            description: i.description,
            required: i.required,
            sort: i.sort,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }

      return createdId;
    });

    if (!taskId) throw badRequest("创建收集任务失败");

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.create`,
      targetType: params.config.module,
      targetId: taskId,
      success: true,
      diff: { source, title: params.body.title, visibleAll, scopesCount: scopes.length, itemsCount: params.body.items.length },
      request: params.request,
    });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.create`,
      targetType: params.config.module,
      targetId: taskId ?? "new",
      success: false,
      errorCode: toErrorCode(err),
      diff: { source, title: params.body.title },
      request: params.request,
    }).catch(() => {});
    throw err;
  }

  return { id: taskId };
}

export async function updateCollectTaskDraft(params: {
  config: CollectModuleConfig;
  actorUserId: string;
  taskId: string;
  body: {
    title: string;
    descriptionMd: string;
    source: CollectSource | null;
    visibleAll: boolean;
    scopes: CollectScopeInput[];
    maxFilesPerSubmission: number;
    dueAt: Date | null;
    items: Array<{ id: string; title: string; description: string | null; required: boolean; sort: number }>;
  };
  actor: AuditActor;
  request: RequestContext;
}) {
  const ok = await hasPerm(params.actorUserId, perm(params.config.module, "update"));
  if (!ok) throw forbidden();

  assertValidSource(params.config.module, params.body.source);

  const task = await assertCanOperateTask({ module: params.config.module, actorUserId: params.actorUserId, taskId: params.taskId });
  if (task.status !== "draft") throw conflict("仅草稿状态允许编辑");
  if (task.archivedAt) throw conflict("已归档任务不允许编辑");

  const now = new Date();
  const source = params.body.source;

  if (source && source.type === "notice") {
    await getSourceMeta(source);
    await assertUniqueSourceBinding({ module: params.config.module, source, excludeTaskId: params.taskId });
  }

  const visibleAll = source ? true : params.body.visibleAll;
  const scopes = source ? [] : params.body.scopes;
  if (!source && visibleAll === false && scopes.length === 0) throw badRequest("可见范围不能为空");

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(collectTasks)
        .set({
          title: params.body.title,
          descriptionMd: params.body.descriptionMd,
          sourceType: source?.type ?? null,
          sourceId: source?.id ?? null,
          visibleAll,
          maxFilesPerSubmission: params.body.maxFilesPerSubmission,
          dueAt: params.body.dueAt ?? null,
          updatedBy: params.actorUserId,
          updatedAt: now,
        })
        .where(and(eq(collectTasks.id, params.taskId), eq(collectTasks.module, params.config.module), isNull(collectTasks.deletedAt)));

      await tx.delete(collectTaskScopes).where(eq(collectTaskScopes.taskId, params.taskId));
      if (!source && scopes.length > 0) {
        await tx.insert(collectTaskScopes).values(scopes.map((s) => ({ taskId: params.taskId, scopeType: s.scopeType, refId: s.refId, createdAt: now })));
      }

      const existingItemRows = await tx
        .select({ id: collectItems.id, templateFileKey: collectItems.templateFileKey })
        .from(collectItems)
        .where(eq(collectItems.taskId, params.taskId));

      const nextIds = new Set(params.body.items.map((i) => i.id));
      const removed = existingItemRows.filter((i) => !nextIds.has(i.id));
      const removedTemplateKeys = removed.map((i) => i.templateFileKey).filter((k): k is string => !!k);

      if (removedTemplateKeys.length > 0) {
        await storageAdapter.remove({ bucket: params.config.templateBucket, keys: removedTemplateKeys });
      }

      if (removed.length > 0) {
        await tx.delete(collectItems).where(inArray(collectItems.id, removed.map((i) => i.id)));
      }

      for (const item of params.body.items) {
        const exists = existingItemRows.some((r) => r.id === item.id);
        if (exists) {
          await tx
            .update(collectItems)
            .set({ title: item.title, description: item.description, required: item.required, sort: item.sort, updatedAt: now })
            .where(and(eq(collectItems.id, item.id), eq(collectItems.taskId, params.taskId)));
        } else {
          await tx.insert(collectItems).values({
            id: item.id,
            taskId: params.taskId,
            kind: "file",
            title: item.title,
            description: item.description,
            required: item.required,
            sort: item.sort,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    });

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.update`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: true,
      diff: {
        before: { title: task.title, sourceType: task.sourceType, sourceId: task.sourceId, visibleAll: task.visibleAll, maxFilesPerSubmission: task.maxFilesPerSubmission },
        after: { title: params.body.title, source, visibleAll, maxFilesPerSubmission: params.body.maxFilesPerSubmission },
        scopesCount: scopes.length,
        itemsCount: params.body.items.length,
      },
      request: params.request,
    });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.update`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: false,
      errorCode: toErrorCode(err),
      diff: { source, title: params.body.title },
      request: params.request,
    }).catch(() => {});
    throw err;
  }

  return getConsoleCollectTaskDetail({ config: params.config, actorUserId: params.actorUserId, taskId: params.taskId });
}

export async function updateCollectTaskDueAt(params: {
  config: CollectModuleConfig;
  actorUserId: string;
  taskId: string;
  dueAt: Date;
  actor: AuditActor;
  request: RequestContext;
}) {
  const ok = await hasPerm(params.actorUserId, perm(params.config.module, "update"));
  if (!ok) throw forbidden();

  const task = await assertCanOperateTask({ module: params.config.module, actorUserId: params.actorUserId, taskId: params.taskId });
  if (task.archivedAt) throw conflict("已归档任务不允许修改截止时间");

  const now = new Date();
  try {
    await db
      .update(collectTasks)
      .set({ dueAt: params.dueAt, updatedBy: params.actorUserId, updatedAt: now })
      .where(and(eq(collectTasks.id, params.taskId), eq(collectTasks.module, params.config.module), isNull(collectTasks.deletedAt)));

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.due.update`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: true,
      diff: { before: task.dueAt?.toISOString() ?? null, after: params.dueAt.toISOString() },
      request: params.request,
    });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.due.update`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: false,
      errorCode: toErrorCode(err),
      diff: { after: params.dueAt.toISOString() },
      request: params.request,
    }).catch(() => {});
    throw err;
  }

  return getConsoleCollectTaskDetail({ config: params.config, actorUserId: params.actorUserId, taskId: params.taskId });
}

export async function publishCollectTask(params: { config: CollectModuleConfig; actorUserId: string; taskId: string; actor: AuditActor; request: RequestContext }) {
  const ok = await hasPerm(params.actorUserId, perm(params.config.module, "publish"));
  if (!ok) throw forbidden();

  const task = await assertCanOperateTask({ module: params.config.module, actorUserId: params.actorUserId, taskId: params.taskId });
  if (task.archivedAt) throw conflict("已归档任务不允许发布");
  if (task.status === "published") return getConsoleCollectTaskDetail({ config: params.config, actorUserId: params.actorUserId, taskId: params.taskId });
  if (task.status !== "draft") throw conflict("仅草稿状态允许发布");

  const now = new Date();
  if (!task.dueAt) throw badRequest("截止时间不能为空");
  if (task.dueAt.getTime() <= now.getTime()) throw badRequest("截止时间必须晚于当前时间");

  const itemsCountRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(collectItems)
    .where(eq(collectItems.taskId, params.taskId));
  if (Number(itemsCountRow[0]?.total ?? 0) <= 0) throw badRequest("至少需要 1 个材料项");

  if (!task.sourceType && task.visibleAll === false) {
    const scopeCountRow = await db
      .select({ total: sql<number>`count(*)` })
      .from(collectTaskScopes)
      .where(eq(collectTaskScopes.taskId, params.taskId));
    if (Number(scopeCountRow[0]?.total ?? 0) <= 0) throw badRequest("可见范围不能为空");
  }

  try {
    await db
      .update(collectTasks)
      .set({ status: "published", updatedBy: params.actorUserId, updatedAt: now })
      .where(and(eq(collectTasks.id, params.taskId), eq(collectTasks.module, params.config.module), isNull(collectTasks.deletedAt)));

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.publish`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: true,
      request: params.request,
    });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.publish`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: false,
      errorCode: toErrorCode(err),
      request: params.request,
    }).catch(() => {});
    throw err;
  }

  return getConsoleCollectTaskDetail({ config: params.config, actorUserId: params.actorUserId, taskId: params.taskId });
}

export async function closeCollectTask(params: { config: CollectModuleConfig; actorUserId: string; taskId: string; actor: AuditActor; request: RequestContext }) {
  const ok = await hasPerm(params.actorUserId, perm(params.config.module, "close"));
  if (!ok) throw forbidden();

  const task = await assertCanOperateTask({ module: params.config.module, actorUserId: params.actorUserId, taskId: params.taskId });
  if (task.archivedAt) throw conflict("已归档任务不允许关闭");
  if (task.status === "closed") return getConsoleCollectTaskDetail({ config: params.config, actorUserId: params.actorUserId, taskId: params.taskId });
  if (task.status !== "published") throw conflict("仅已发布任务允许关闭");

  const now = new Date();
  try {
    await db
      .update(collectTasks)
      .set({ status: "closed", updatedBy: params.actorUserId, updatedAt: now })
      .where(and(eq(collectTasks.id, params.taskId), eq(collectTasks.module, params.config.module), isNull(collectTasks.deletedAt)));

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.close`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: true,
      request: params.request,
    });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.close`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: false,
      errorCode: toErrorCode(err),
      request: params.request,
    }).catch(() => {});
    throw err;
  }

  return getConsoleCollectTaskDetail({ config: params.config, actorUserId: params.actorUserId, taskId: params.taskId });
}

export async function archiveCollectTask(params: { config: CollectModuleConfig; actorUserId: string; taskId: string; actor: AuditActor; request: RequestContext }) {
  const ok = await hasPerm(params.actorUserId, perm(params.config.module, "archive"));
  if (!ok) throw forbidden();

  const task = await assertCanOperateTask({ module: params.config.module, actorUserId: params.actorUserId, taskId: params.taskId });
  if (task.archivedAt) return getConsoleCollectTaskDetail({ config: params.config, actorUserId: params.actorUserId, taskId: params.taskId });
  if (task.status !== "closed") throw conflict("仅已关闭任务允许归档");

  const now = new Date();
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(collectTasks)
        .set({ archivedAt: now, updatedBy: params.actorUserId, updatedAt: now })
        .where(and(eq(collectTasks.id, params.taskId), eq(collectTasks.module, params.config.module), isNull(collectTasks.deletedAt)));
      await tx.update(collectSubmissions).set({ archivedAt: now }).where(eq(collectSubmissions.taskId, params.taskId));
    });

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.archive`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: true,
      request: params.request,
    });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.archive`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: false,
      errorCode: toErrorCode(err),
      request: params.request,
    }).catch(() => {});
    throw err;
  }

  return getConsoleCollectTaskDetail({ config: params.config, actorUserId: params.actorUserId, taskId: params.taskId });
}

export async function deleteCollectTask(params: {
  config: CollectModuleConfig;
  actorUserId: string;
  taskId: string;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  const ok = await hasPerm(params.actorUserId, perm(params.config.module, "delete"));
  if (!ok) throw forbidden();

  const task = await assertCanOperateTask({ module: params.config.module, actorUserId: params.actorUserId, taskId: params.taskId });

  const now = new Date();
  try {
    const updated = await db
      .update(collectTasks)
      .set({ deletedAt: now, updatedBy: params.actorUserId, updatedAt: now })
      .where(and(eq(collectTasks.id, params.taskId), eq(collectTasks.module, params.config.module), isNull(collectTasks.deletedAt)))
      .returning({ id: collectTasks.id });

    if (updated.length === 0) throw notFound();

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.delete`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: true,
      reason: params.reason,
      diff: { before: { title: task.title, status: task.status }, after: { deletedAt: now.toISOString() } },
      request: params.request,
    });

    return { ok: true as const };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.delete`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: false,
      errorCode: toErrorCode(err),
      reason: params.reason,
      diff: { before: { title: task.title, status: task.status } },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function uploadCollectItemTemplate(params: {
  config: CollectModuleConfig;
  actorUserId: string;
  taskId: string;
  itemId: string;
  file: File;
  actor: AuditActor;
  request: RequestContext;
}) {
  const ok = await hasPerm(params.actorUserId, perm(params.config.module, "update"));
  if (!ok) throw forbidden();

  const task = await assertCanOperateTask({ module: params.config.module, actorUserId: params.actorUserId, taskId: params.taskId });
  if (task.archivedAt) throw conflict("已归档任务不允许上传模板");
  if (task.status === "closed") throw conflict("已关闭任务不允许上传模板");

  if (params.file.size <= 0) throw badRequest("文件为空");
  if (params.file.size > MAX_TEMPLATE_BYTES) throw badRequest("模板文件过大（最大 20MB）");

  const itemRows = await db
    .select({
      id: collectItems.id,
      templateFileKey: collectItems.templateFileKey,
      templateFileName: collectItems.templateFileName,
      templateContentType: collectItems.templateContentType,
      templateSize: collectItems.templateSize,
    })
    .from(collectItems)
    .where(and(eq(collectItems.id, params.itemId), eq(collectItems.taskId, params.taskId)))
    .limit(1);
  const item = itemRows[0];
  if (!item) throw notFound("材料项不存在");

  const safeName = sanitizeStorageObjectKeyPart(params.file.name).slice(0, 80);
  const objectKey = `collect/${params.config.module}/tasks/${params.taskId}/templates/${params.itemId}/${crypto.randomUUID()}-${safeName}`;
  const contentType = safeContentType(params.file);

  const before = item.templateFileKey
    ? {
        fileKey: item.templateFileKey,
        fileName: item.templateFileName,
        contentType: item.templateContentType,
        size: item.templateSize,
      }
    : null;

  try {
    await storageAdapter.uploadPrivate({
      bucket: params.config.templateBucket,
      key: objectKey,
      file: params.file,
      contentType,
      upsert: false,
      cacheControl: "3600",
    });

    if (item.templateFileKey) {
      await storageAdapter.remove({ bucket: params.config.templateBucket, keys: [item.templateFileKey] });
    }

    await db
      .update(collectItems)
      .set({
        templateFileKey: objectKey,
        templateFileName: params.file.name,
        templateContentType: contentType,
        templateSize: params.file.size,
      })
      .where(and(eq(collectItems.id, params.itemId), eq(collectItems.taskId, params.taskId)));

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.item.template.upload`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: true,
      diff: { itemId: params.itemId, before, after: { fileKey: objectKey, fileName: params.file.name, contentType, size: params.file.size } },
      request: params.request,
    });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.item.template.upload`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: false,
      errorCode: toErrorCode(err),
      diff: { itemId: params.itemId, fileName: params.file.name, size: params.file.size },
      request: params.request,
    }).catch(() => {});
    throw err instanceof HttpError ? err : badRequest("上传失败", { message: toStorageError(err) });
  }

  return getConsoleCollectTaskDetail({ config: params.config, actorUserId: params.actorUserId, taskId: params.taskId });
}

async function buildPortalTaskVisibility(params: { module: string; userId: string }) {
  const ctx = await getAudienceContext(params.userId);

  const [visibleTaskIds, visibleNoticeIds] = await Promise.all([
    getVisibleIdsForUser({
      ctx,
      scopesTable: collectTaskScopes,
      resourceIdColumn: collectTaskScopes.taskId,
      scopeTypeColumn: collectTaskScopes.scopeType,
      refIdColumn: collectTaskScopes.refId,
    }),
    getVisibleIdsForUser({
      ctx,
      scopesTable: noticeScopes,
      resourceIdColumn: noticeScopes.noticeId,
      scopeTypeColumn: noticeScopes.scopeType,
      refIdColumn: noticeScopes.refId,
    }),
  ]);

  const taskVisibility = buildVisibilityCondition({ visibleIds: visibleTaskIds, visibleAllColumn: collectTasks.visibleAll, idColumn: collectTasks.id });
  const noticeVisibility = buildVisibilityCondition({ visibleIds: visibleNoticeIds, visibleAllColumn: notices.visibleAll, idColumn: notices.id });

  return { taskVisibility, noticeVisibility };
}

export async function listPortalCollectTasks(params: { config: CollectModuleConfig; userId: string; page: number; pageSize: number; q?: string }) {
  const { taskVisibility, noticeVisibility } = await buildPortalTaskVisibility({ module: params.config.module, userId: params.userId });

  const where = [
    eq(collectTasks.module, params.config.module),
    isNull(collectTasks.deletedAt),
    sql`${collectTasks.archivedAt} is null`,
    or(eq(collectTasks.status, "published"), eq(collectTasks.status, "closed"))!,
    or(
      and(sql`${collectTasks.sourceId} is null`, taskVisibility),
      and(
        sql`${collectTasks.sourceId} is not null`,
        eq(collectTasks.sourceType, "notice"),
        eq(notices.status, "published"),
        isNull(notices.deletedAt),
        noticeVisibility,
      ),
    )!,
  ];

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    where.push(sql`${collectTasks.title} ilike ${pattern}`);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(collectTasks)
    .leftJoin(notices, eq(notices.id, collectTasks.sourceId))
    .where(and(...where));

  const rows = await db
    .select({
      id: collectTasks.id,
      title: collectTasks.title,
      status: collectTasks.status,
      sourceType: collectTasks.sourceType,
      sourceId: collectTasks.sourceId,
      dueAt: collectTasks.dueAt,
      updatedAt: collectTasks.updatedAt,
    })
    .from(collectTasks)
    .leftJoin(notices, eq(notices.id, collectTasks.sourceId))
    .where(and(...where))
    .orderBy(desc(collectTasks.updatedAt), desc(collectTasks.id))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status as CollectTaskStatus,
      source: r.sourceType && r.sourceId ? ({ type: r.sourceType as "notice", id: r.sourceId } satisfies CollectSource) : null,
      dueAt: r.dueAt,
      updatedAt: r.updatedAt,
    })),
  };
}

export async function findPortalCollectTaskBySource(params: { config: CollectModuleConfig; userId: string; source: CollectSource }) {
  assertValidSource(params.config.module, params.source);
  if (params.source.type !== "notice") throw badRequest(`不支持的 source.type：${params.source.type}`);

  const { noticeVisibility } = await buildPortalTaskVisibility({ module: params.config.module, userId: params.userId });

  const rows = await db
    .select({
      id: collectTasks.id,
      title: collectTasks.title,
      status: collectTasks.status,
      dueAt: collectTasks.dueAt,
      updatedAt: collectTasks.updatedAt,
    })
    .from(collectTasks)
    .leftJoin(notices, eq(notices.id, collectTasks.sourceId))
    .where(
      and(
        eq(collectTasks.module, params.config.module),
        isNull(collectTasks.deletedAt),
        sql`${collectTasks.archivedAt} is null`,
        or(eq(collectTasks.status, "published"), eq(collectTasks.status, "closed"))!,
        eq(collectTasks.sourceType, "notice"),
        eq(collectTasks.sourceId, params.source.id),
        eq(notices.status, "published"),
        isNull(notices.deletedAt),
        noticeVisibility,
      ),
    )
    .limit(1);

  const task = rows[0];
  if (!task) return null;

  const now = new Date();
  const canSubmit = task.status === "published" && !!task.dueAt && now.getTime() <= task.dueAt.getTime();

  return {
    id: task.id,
    title: task.title,
    status: task.status as CollectTaskStatus,
    dueAt: task.dueAt as Date | null,
    canSubmit,
    updatedAt: task.updatedAt as Date,
  };
}

export async function getPortalCollectTaskDetail(params: { config: CollectModuleConfig; userId: string; taskId: string }) {
  const { taskVisibility, noticeVisibility } = await buildPortalTaskVisibility({ module: params.config.module, userId: params.userId });

  const rows = await db
    .select({
      id: collectTasks.id,
      title: collectTasks.title,
      descriptionMd: collectTasks.descriptionMd,
      status: collectTasks.status,
      sourceType: collectTasks.sourceType,
      sourceId: collectTasks.sourceId,
      maxFilesPerSubmission: collectTasks.maxFilesPerSubmission,
      dueAt: collectTasks.dueAt,
      archivedAt: collectTasks.archivedAt,
      noticeTitle: notices.title,
    })
    .from(collectTasks)
    .leftJoin(notices, eq(notices.id, collectTasks.sourceId))
    .where(
      and(
        eq(collectTasks.id, params.taskId),
        eq(collectTasks.module, params.config.module),
        isNull(collectTasks.deletedAt),
        sql`${collectTasks.archivedAt} is null`,
        or(eq(collectTasks.status, "published"), eq(collectTasks.status, "closed"))!,
        or(
          and(sql`${collectTasks.sourceId} is null`, taskVisibility),
          and(
            sql`${collectTasks.sourceId} is not null`,
            eq(collectTasks.sourceType, "notice"),
            eq(notices.status, "published"),
            isNull(notices.deletedAt),
            noticeVisibility,
          ),
        )!,
      ),
    )
    .limit(1);

  const task = rows[0];
  if (!task) throw notFound();

  const source = task.sourceType && task.sourceId ? ({ type: task.sourceType as "notice", id: task.sourceId } satisfies CollectSource) : null;
  const sourceMeta = source && source.type === "notice" && task.noticeTitle ? { type: "notice" as const, id: source.id, title: task.noticeTitle } : null;
  const now = new Date();
  const canSubmit = task.status === "published" && !!task.dueAt && now.getTime() <= task.dueAt.getTime();

  const [itemRows, submissionRows] = await Promise.all([
    db
      .select({
        id: collectItems.id,
        kind: collectItems.kind,
        title: collectItems.title,
        description: collectItems.description,
        required: collectItems.required,
        sort: collectItems.sort,
        templateFileKey: collectItems.templateFileKey,
        templateFileName: collectItems.templateFileName,
        templateContentType: collectItems.templateContentType,
        templateSize: collectItems.templateSize,
        createdAt: collectItems.createdAt,
      })
      .from(collectItems)
      .where(eq(collectItems.taskId, task.id))
      .orderBy(asc(collectItems.sort), asc(collectItems.createdAt)),
    db
      .select({
        id: collectSubmissions.id,
        submittedAt: collectSubmissions.submittedAt,
        withdrawnAt: collectSubmissions.withdrawnAt,
        status: collectSubmissions.status,
        studentMessage: collectSubmissions.studentMessage,
      })
      .from(collectSubmissions)
      .where(and(eq(collectSubmissions.taskId, task.id), eq(collectSubmissions.userId, params.userId)))
      .limit(1),
  ]);

  const submission = submissionRows[0] ?? null;

  const fileRows =
    submission && !submission.withdrawnAt
      ? await db
          .select({
            id: collectSubmissionFiles.id,
            itemId: collectSubmissionFiles.itemId,
            fileKey: collectSubmissionFiles.fileKey,
            fileName: collectSubmissionFiles.fileName,
            contentType: collectSubmissionFiles.contentType,
            size: collectSubmissionFiles.size,
            createdAt: collectSubmissionFiles.createdAt,
          })
          .from(collectSubmissionFiles)
          .where(eq(collectSubmissionFiles.submissionId, submission.id))
          .orderBy(asc(collectSubmissionFiles.sort), asc(collectSubmissionFiles.createdAt))
      : [];

  const requiredItemIds = itemRows.filter((i) => i.required).map((i) => i.id);
  const providedRequiredSet = new Set(fileRows.filter((f) => requiredItemIds.includes(f.itemId)).map((f) => f.itemId));
  const missingRequired = requiredItemIds.some((id) => !providedRequiredSet.has(id));

  const templateSigned = await Promise.all(
    itemRows.map(async (i) => {
      if (!i.templateFileKey || !i.templateFileName) return { itemId: i.id, downloadUrl: null as string | null };
      try {
        const res = await storageAdapter.createSignedDownloadUrl({
          bucket: params.config.templateBucket,
          key: i.templateFileKey,
          expiresIn: SIGNED_URL_EXPIRES_IN,
          download: i.templateFileName ?? true,
        });
        return { itemId: i.id, downloadUrl: res.signedUrl };
      } catch {
        return { itemId: i.id, downloadUrl: null as string | null };
      }
    }),
  );
  const templateUrlMap = new Map(templateSigned.map((t) => [t.itemId, t.downloadUrl] as const));

  const fileSigned = await Promise.all(
    fileRows.map(async (f) => {
      try {
        const res = await storageAdapter.createSignedDownloadUrl({
          bucket: params.config.submissionBucket,
          key: f.fileKey,
          expiresIn: SIGNED_URL_EXPIRES_IN,
          download: f.fileName ?? true,
        });
        return { fileId: f.id, downloadUrl: res.signedUrl };
      } catch {
        return { fileId: f.id, downloadUrl: null };
      }
    }),
  );
  const fileUrlMap = new Map(fileSigned.map((t) => [t.fileId, t.downloadUrl] as const));

  return {
    id: task.id,
    title: task.title,
    descriptionMd: task.descriptionMd,
    status: task.status as CollectTaskStatus,
    maxFilesPerSubmission: task.maxFilesPerSubmission,
    dueAt: task.dueAt,
    canSubmit,
    source,
    sourceMeta,
    items: itemRows.map((i) => ({
      id: i.id,
      kind: i.kind as "file",
      title: i.title,
      description: i.description,
      required: i.required,
      sort: i.sort,
      template:
        i.templateFileKey && i.templateFileName && i.templateContentType && typeof i.templateSize === "number"
          ? {
              fileName: i.templateFileName,
              contentType: i.templateContentType,
              size: i.templateSize,
              downloadUrl: templateUrlMap.get(i.id) ?? null,
            }
          : null,
    })),
    mySubmission: submission
      ? {
          id: submission.id,
          submittedAt: submission.submittedAt,
          withdrawnAt: submission.withdrawnAt,
          status: submission.status as CollectSubmissionStatus,
          studentMessage: submission.studentMessage,
          missingRequired,
          files: fileRows.map((f) => ({
            id: f.id,
            itemId: f.itemId,
            fileName: f.fileName,
            contentType: f.contentType,
            size: f.size,
            downloadUrl: fileUrlMap.get(f.id) ?? null,
          })),
        }
      : null,
  };
}

async function getOrCreateMySubmission(params: { taskId: string; userId: string }) {
  const now = new Date();
  const inserted = await db
    .insert(collectSubmissions)
    .values({ taskId: params.taskId, userId: params.userId, status: "pending", createdAt: now, updatedAt: now })
    .onConflictDoNothing()
    .returning({ id: collectSubmissions.id });

  if (inserted[0]) return { id: inserted[0].id };

  const rows = await db
    .select({ id: collectSubmissions.id })
    .from(collectSubmissions)
    .where(and(eq(collectSubmissions.taskId, params.taskId), eq(collectSubmissions.userId, params.userId)))
    .limit(1);
  if (!rows[0]) throw new Error("创建提交失败");
  return { id: rows[0].id };
}

export async function uploadMyCollectFile(params: {
  config: CollectModuleConfig;
  userId: string;
  taskId: string;
  itemId: string;
  file: File;
  actor: AuditActor;
  request: RequestContext;
}) {
  if (params.file.size <= 0) throw badRequest("文件为空");
  if (params.file.size > MAX_SUBMISSION_FILE_BYTES) throw badRequest("文件过大（最大 200MB）");

  const detail = await getPortalCollectTaskDetail({ config: params.config, userId: params.userId, taskId: params.taskId });
  if (detail.status !== "published") throw conflict("任务不可提交");
  if (!detail.dueAt) throw conflict("任务不可提交");
  if (Date.now() > detail.dueAt.getTime()) throw conflict("已截止，禁止提交");

  const item = detail.items.find((i) => i.id === params.itemId);
  if (!item) throw badRequest("材料项不属于该任务");
  if (item.kind !== "file") throw badRequest("该材料项不支持上传文件");

  const submission = await getOrCreateMySubmission({ taskId: params.taskId, userId: params.userId });
  await db
    .update(collectSubmissions)
    .set({ withdrawnAt: null, updatedAt: new Date() })
    .where(and(eq(collectSubmissions.id, submission.id), sql`${collectSubmissions.withdrawnAt} is not null`));

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(collectSubmissionFiles)
    .where(eq(collectSubmissionFiles.submissionId, submission.id));
  const total = Number(countRow[0]?.total ?? 0);
  if (total >= detail.maxFilesPerSubmission) throw badRequest(`最多上传 ${detail.maxFilesPerSubmission} 个文件`);

  const safeName = sanitizeStorageObjectKeyPart(params.file.name).slice(0, 80);
  const objectKey = `collect/${params.config.module}/tasks/${params.taskId}/submissions/${params.userId}/${params.itemId}/${crypto.randomUUID()}-${safeName}`;
  const contentType = safeContentType(params.file);

  try {
    await storageAdapter.uploadPrivate({
      bucket: params.config.submissionBucket,
      key: objectKey,
      file: params.file,
      contentType,
      upsert: false,
      cacheControl: "3600",
    });

    const inserted = await db
      .insert(collectSubmissionFiles)
      .values({
        submissionId: submission.id,
        itemId: params.itemId,
        fileKey: objectKey,
        fileName: params.file.name,
        contentType,
        size: params.file.size,
        sort: total,
      })
      .returning({ id: collectSubmissionFiles.id });

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.submission.file.upload`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: true,
      diff: { submissionId: submission.id, itemId: params.itemId, fileKey: objectKey, fileName: params.file.name, size: params.file.size },
      request: params.request,
    });

    return { id: inserted[0]!.id, itemId: params.itemId, fileName: params.file.name, contentType, size: params.file.size };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.submission.file.upload`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: false,
      errorCode: toErrorCode(err),
      diff: { itemId: params.itemId, fileName: params.file.name, size: params.file.size },
      request: params.request,
    }).catch(() => {});
    throw err instanceof HttpError ? err : badRequest("上传失败", { message: toStorageError(err) });
  }
}

export async function deleteMyCollectFile(params: {
  config: CollectModuleConfig;
  userId: string;
  taskId: string;
  fileId: string;
  actor: AuditActor;
  request: RequestContext;
}) {
  const detail = await getPortalCollectTaskDetail({ config: params.config, userId: params.userId, taskId: params.taskId });
  if (detail.status !== "published") throw conflict("任务不可提交");
  if (!detail.dueAt) throw conflict("任务不可提交");
  if (Date.now() > detail.dueAt.getTime()) throw conflict("已截止，禁止修改提交");

  const submissionRows = await db
    .select({ id: collectSubmissions.id })
    .from(collectSubmissions)
    .where(and(eq(collectSubmissions.taskId, params.taskId), eq(collectSubmissions.userId, params.userId)))
    .limit(1);
  const submission = submissionRows[0];
  if (!submission) throw notFound("提交不存在");

  const fileRows = await db
    .select({ id: collectSubmissionFiles.id, fileKey: collectSubmissionFiles.fileKey })
    .from(collectSubmissionFiles)
    .where(and(eq(collectSubmissionFiles.id, params.fileId), eq(collectSubmissionFiles.submissionId, submission.id)))
    .limit(1);
  const file = fileRows[0];
  if (!file) throw notFound("文件不存在");

  try {
    await storageAdapter.remove({ bucket: params.config.submissionBucket, keys: [file.fileKey] });
    await db.delete(collectSubmissionFiles).where(eq(collectSubmissionFiles.id, params.fileId));

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.submission.file.delete`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: true,
      diff: { fileId: params.fileId, fileKey: file.fileKey },
      request: params.request,
    });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.submission.file.delete`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: false,
      errorCode: toErrorCode(err),
      diff: { fileId: params.fileId, fileKey: file.fileKey },
      request: params.request,
    }).catch(() => {});
    throw err;
  }

  return { ok: true };
}

async function assertMySubmissionMeetsRequired(params: { taskId: string; submissionId: string }) {
  const requiredRows = await db
    .select({ id: collectItems.id })
    .from(collectItems)
    .where(and(eq(collectItems.taskId, params.taskId), eq(collectItems.required, true)));
  const requiredIds = requiredRows.map((r) => r.id);
  if (requiredIds.length === 0) return { missingItemIds: [] as string[] };

  const fileRows = await db
    .select({ itemId: collectSubmissionFiles.itemId })
    .from(collectSubmissionFiles)
    .where(and(eq(collectSubmissionFiles.submissionId, params.submissionId), inArray(collectSubmissionFiles.itemId, requiredIds)));
  const set = new Set(fileRows.map((f) => f.itemId));
  const missing = requiredIds.filter((id) => !set.has(id));
  return { missingItemIds: missing };
}

export async function submitMyCollect(params: { config: CollectModuleConfig; userId: string; taskId: string; actor: AuditActor; request: RequestContext }) {
  const detail = await getPortalCollectTaskDetail({ config: params.config, userId: params.userId, taskId: params.taskId });
  if (detail.status !== "published") throw conflict("任务不可提交");
  if (!detail.dueAt) throw conflict("任务不可提交");
  if (Date.now() > detail.dueAt.getTime()) throw conflict("已截止，禁止提交");

  const submission = await getOrCreateMySubmission({ taskId: params.taskId, userId: params.userId });
  const { missingItemIds } = await assertMySubmissionMeetsRequired({ taskId: params.taskId, submissionId: submission.id });
  if (missingItemIds.length > 0) throw badRequest("缺少必交材料", { missingItemIds });

  const now = new Date();
  try {
    await db
      .update(collectSubmissions)
      .set({
        submittedAt: now,
        withdrawnAt: null,
        status: "pending",
        studentMessage: null,
        updatedAt: now,
      })
      .where(eq(collectSubmissions.id, submission.id));

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.submission.submit`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: true,
      diff: { submissionId: submission.id, submittedAt: now.toISOString() },
      request: params.request,
    });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.submission.submit`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: false,
      errorCode: toErrorCode(err),
      diff: { submissionId: submission.id },
      request: params.request,
    }).catch(() => {});
    throw err;
  }

  return { ok: true, submissionId: submission.id, submittedAt: now.toISOString() };
}

export async function withdrawMyCollect(params: { config: CollectModuleConfig; userId: string; taskId: string; actor: AuditActor; request: RequestContext }) {
  const submissionRows = await db
    .select({
      id: collectSubmissions.id,
      submittedAt: collectSubmissions.submittedAt,
      withdrawnAt: collectSubmissions.withdrawnAt,
    })
    .from(collectSubmissions)
    .where(and(eq(collectSubmissions.taskId, params.taskId), eq(collectSubmissions.userId, params.userId)))
    .limit(1);

  const submission = submissionRows[0];
  if (!submission) throw notFound("提交不存在");
  if (!submission.submittedAt) throw conflict("尚未提交，无需撤回");
  if (submission.withdrawnAt) return { ok: true };

  const fileRows = await db
    .select({ fileKey: collectSubmissionFiles.fileKey })
    .from(collectSubmissionFiles)
    .where(eq(collectSubmissionFiles.submissionId, submission.id));
  const keys = fileRows.map((f) => f.fileKey);

  const now = new Date();
  try {
    if (keys.length > 0) {
      await storageAdapter.remove({ bucket: params.config.submissionBucket, keys });
    }

    await db.transaction(async (tx) => {
      await tx.delete(collectSubmissionFiles).where(eq(collectSubmissionFiles.submissionId, submission.id));
      await tx
        .update(collectSubmissions)
        .set({
          withdrawnAt: now,
          submittedAt: null,
          assigneeUserId: null,
          status: "pending",
          studentMessage: null,
          updatedAt: now,
        })
        .where(eq(collectSubmissions.id, submission.id));
    });

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.submission.withdraw`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: true,
      diff: { submissionId: submission.id, deletedFiles: keys.length },
      request: params.request,
    });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.submission.withdraw`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: false,
      errorCode: toErrorCode(err),
      diff: { submissionId: submission.id, deletedFiles: keys.length },
      request: params.request,
    }).catch(() => {});
    throw err;
  }

  return { ok: true };
}

export async function listConsoleCollectSubmissions(params: {
  config: CollectModuleConfig;
  actorUserId: string;
  taskId: string;
  page: number;
  pageSize: number;
  q?: string;
  status?: CollectSubmissionStatus;
  missingRequired?: boolean;
  from?: Date;
  to?: Date;
  departmentId?: string;
}) {
  const ok = await hasPerm(params.actorUserId, perm(params.config.module, "process"));
  if (!ok) throw forbidden();

  await getTaskBaseForConsole({ module: params.config.module, actorUserId: params.actorUserId, taskId: params.taskId });

  const where = [eq(collectSubmissions.taskId, params.taskId), sql`${collectSubmissions.withdrawnAt} is null`];

  if (params.status) where.push(eq(collectSubmissions.status, params.status));
  if (params.from) where.push(sql`${collectSubmissions.submittedAt} >= ${params.from.toISOString()}`);
  if (params.to) where.push(sql`${collectSubmissions.submittedAt} <= ${params.to.toISOString()}`);

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    where.push(or(sql`${profiles.name} ilike ${pattern}`, sql`${profiles.studentId} ilike ${pattern}`)!);
  }

  if (params.departmentId) {
    const sub = db
      .select({ userId: userDepartments.userId })
      .from(userDepartments)
      .innerJoin(departmentClosure, eq(departmentClosure.descendantId, userDepartments.departmentId))
      .where(eq(departmentClosure.ancestorId, params.departmentId));
    where.push(inArray(collectSubmissions.userId, sub));
  }

  const missingCond = sql<boolean>`exists (
    select 1 from public.collect_items i
    where i.task_id = ${params.taskId} and i.required = true
      and not exists (
        select 1 from public.collect_submission_files f
        where f.submission_id = ${collectSubmissions.id} and f.item_id = i.id
      )
  )`;
  if (typeof params.missingRequired === "boolean") {
    where.push(params.missingRequired ? missingCond : sql`not (${missingCond})`);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(collectSubmissions)
    .innerJoin(profiles, eq(profiles.id, collectSubmissions.userId))
    .where(and(...where));

  const rows = await db
    .select({
      id: collectSubmissions.id,
      userId: collectSubmissions.userId,
      submittedAt: collectSubmissions.submittedAt,
      status: collectSubmissions.status,
      assigneeUserId: collectSubmissions.assigneeUserId,
      studentMessage: collectSubmissions.studentMessage,
      missingRequired: missingCond,
      name: profiles.name,
      studentId: profiles.studentId,
    })
    .from(collectSubmissions)
    .innerJoin(profiles, eq(profiles.id, collectSubmissions.userId))
    .where(and(...where))
    .orderBy(desc(collectSubmissions.submittedAt), desc(collectSubmissions.updatedAt), desc(collectSubmissions.id))
    .limit(params.pageSize)
    .offset(offset);

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const deptRows =
    userIds.length === 0
      ? []
      : await db
          .select({ userId: userDepartments.userId, name: departments.name })
          .from(userDepartments)
          .innerJoin(departments, eq(departments.id, userDepartments.departmentId))
          .where(inArray(userDepartments.userId, userIds))
          .orderBy(asc(departments.name));

  const deptMap = new Map<string, string[]>();
  for (const r of deptRows) {
    const list = deptMap.get(r.userId) ?? [];
    list.push(r.name);
    deptMap.set(r.userId, list);
  }

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      studentId: r.studentId,
      departments: deptMap.get(r.userId) ?? [],
      submittedAt: r.submittedAt,
      status: r.status as CollectSubmissionStatus,
      assigneeUserId: r.assigneeUserId,
      studentMessage: r.studentMessage,
      missingRequired: !!r.missingRequired,
    })),
  };
}

export async function getConsoleCollectSubmissionDetail(params: {
  config: CollectModuleConfig;
  actorUserId: string;
  taskId: string;
  submissionId: string;
  includeDownloadUrls: boolean;
}) {
  const ok = await hasPerm(params.actorUserId, perm(params.config.module, "process"));
  if (!ok) throw forbidden();

  await getTaskBaseForConsole({ module: params.config.module, actorUserId: params.actorUserId, taskId: params.taskId });

  const submissionRows = await db
    .select({
      id: collectSubmissions.id,
      userId: collectSubmissions.userId,
      submittedAt: collectSubmissions.submittedAt,
      status: collectSubmissions.status,
      assigneeUserId: collectSubmissions.assigneeUserId,
      studentMessage: collectSubmissions.studentMessage,
      staffNote: collectSubmissions.staffNote,
      name: profiles.name,
      studentId: profiles.studentId,
    })
    .from(collectSubmissions)
    .innerJoin(profiles, eq(profiles.id, collectSubmissions.userId))
    .where(and(eq(collectSubmissions.taskId, params.taskId), eq(collectSubmissions.id, params.submissionId), sql`${collectSubmissions.withdrawnAt} is null`))
    .limit(1);

  const submission = submissionRows[0];
  if (!submission) throw notFound("提交不存在");

  const [deptRows, itemRows, fileRows] = await Promise.all([
    db
      .select({ name: departments.name })
      .from(userDepartments)
      .innerJoin(departments, eq(departments.id, userDepartments.departmentId))
      .where(eq(userDepartments.userId, submission.userId))
      .orderBy(asc(departments.name)),
    db
      .select({
        id: collectItems.id,
        title: collectItems.title,
        description: collectItems.description,
        required: collectItems.required,
        sort: collectItems.sort,
        createdAt: collectItems.createdAt,
      })
      .from(collectItems)
      .where(eq(collectItems.taskId, params.taskId))
      .orderBy(asc(collectItems.sort), asc(collectItems.createdAt)),
    db
      .select({
        id: collectSubmissionFiles.id,
        itemId: collectSubmissionFiles.itemId,
        fileKey: collectSubmissionFiles.fileKey,
        fileName: collectSubmissionFiles.fileName,
        contentType: collectSubmissionFiles.contentType,
        size: collectSubmissionFiles.size,
        sort: collectSubmissionFiles.sort,
        createdAt: collectSubmissionFiles.createdAt,
      })
      .from(collectSubmissionFiles)
      .where(eq(collectSubmissionFiles.submissionId, submission.id))
      .orderBy(asc(collectSubmissionFiles.sort), asc(collectSubmissionFiles.createdAt)),
  ]);

  const missingRequiredItemIds = itemRows
    .filter((i) => i.required)
    .map((i) => i.id)
    .filter((id) => !fileRows.some((f) => f.itemId === id));
  const missingRequired = missingRequiredItemIds.length > 0;

  const fileSigned = params.includeDownloadUrls
    ? await Promise.all(
        fileRows.map(async (f) => {
          try {
            const res = await storageAdapter.createSignedDownloadUrl({
              bucket: params.config.submissionBucket,
              key: f.fileKey,
              expiresIn: SIGNED_URL_EXPIRES_IN,
              download: f.fileName ?? true,
            });
            return { fileId: f.id, downloadUrl: res.signedUrl };
          } catch {
            return { fileId: f.id, downloadUrl: null as string | null };
          }
        }),
      )
    : fileRows.map((f) => ({ fileId: f.id, downloadUrl: null as string | null }));
  const fileUrlMap = new Map(fileSigned.map((t) => [t.fileId, t.downloadUrl] as const));

  const filesByItemId = new Map<string, typeof fileRows>();
  for (const f of fileRows) {
    const list = filesByItemId.get(f.itemId) ?? [];
    list.push(f);
    filesByItemId.set(f.itemId, list);
  }

  const totalBytes = fileRows.reduce((sum, f) => sum + (Number(f.size) || 0), 0);

  return {
    id: submission.id,
    userId: submission.userId,
    name: submission.name,
    studentId: submission.studentId,
    departments: deptRows.map((d) => d.name),
    submittedAt: submission.submittedAt,
    status: submission.status as CollectSubmissionStatus,
    assigneeUserId: submission.assigneeUserId,
    studentMessage: submission.studentMessage,
    staffNote: submission.staffNote,
    missingRequired,
    missingRequiredItemIds,
    fileCount: fileRows.length,
    totalBytes,
    items: itemRows.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      required: i.required,
      sort: i.sort,
      files: (filesByItemId.get(i.id) ?? []).map((f) => ({
        id: f.id,
        fileName: f.fileName,
        contentType: f.contentType,
        size: f.size,
        createdAt: f.createdAt,
        downloadUrl: fileUrlMap.get(f.id) ?? null,
      })),
    })),
  };
}

export async function batchProcessCollectSubmissions(params: {
  config: CollectModuleConfig;
  actorUserId: string;
  taskId: string;
  body: {
    submissionIds: string[];
    action: "assignToMe" | "unassign" | "setStatus";
    status?: CollectSubmissionStatus;
    studentMessage?: string | null;
    staffNote?: string | null;
  };
  actor: AuditActor;
  request: RequestContext;
}) {
  const ok = await hasPerm(params.actorUserId, perm(params.config.module, "process"));
  if (!ok) throw forbidden();

  await assertCanOperateTask({ module: params.config.module, actorUserId: params.actorUserId, taskId: params.taskId });

  const now = new Date();
  const action = params.body.action;
  const submissionIds = [...new Set(params.body.submissionIds)];

  if (action === "setStatus") {
    if (!params.body.status) throw badRequest("缺少 status");
    const next = params.body.status;
    const msg = params.body.studentMessage?.trim() ?? "";
    if ((next === "need_more" || next === "rejected") && !msg) {
      throw badRequest("需补/驳回 必须填写原因");
    }
  }

  try {
    if (action === "assignToMe") {
      await db
        .update(collectSubmissions)
        .set({ assigneeUserId: params.actorUserId, updatedAt: now })
        .where(and(eq(collectSubmissions.taskId, params.taskId), inArray(collectSubmissions.id, submissionIds)));
    } else if (action === "unassign") {
      await db
        .update(collectSubmissions)
        .set({ assigneeUserId: null, updatedAt: now })
        .where(and(eq(collectSubmissions.taskId, params.taskId), inArray(collectSubmissions.id, submissionIds)));
    } else if (action === "setStatus") {
      await db
        .update(collectSubmissions)
        .set({
          status: params.body.status!,
          studentMessage: params.body.studentMessage ?? null,
          staffNote: params.body.staffNote ?? null,
          updatedAt: now,
        })
        .where(and(eq(collectSubmissions.taskId, params.taskId), inArray(collectSubmissions.id, submissionIds)));
    }

    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.submission.batch`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: true,
      diff: { action, submissionCount: submissionIds.length, status: params.body.status, studentMessage: params.body.studentMessage ?? null },
      request: params.request,
    });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: `${params.config.module}.submission.batch`,
      targetType: params.config.module,
      targetId: params.taskId,
      success: false,
      errorCode: toErrorCode(err),
      diff: { action, submissionCount: submissionIds.length },
      request: params.request,
    }).catch(() => {});
    throw err;
  }

  return { ok: true };
}

export async function exportCollectZip(params: {
  config: CollectModuleConfig;
  actorUserId: string;
  taskId: string;
  filters: {
    q?: string;
    status?: CollectSubmissionStatus;
    missingRequired?: boolean;
    from?: Date;
    to?: Date;
    departmentId?: string;
    includeUnsubmitted?: boolean;
  };
}) {
  const ok = await hasPerm(params.actorUserId, perm(params.config.module, "export"));
  if (!ok) throw forbidden();

  const task = await assertCanOperateTask({ module: params.config.module, actorUserId: params.actorUserId, taskId: params.taskId });

  const itemRows = await db
    .select({ id: collectItems.id, title: collectItems.title, required: collectItems.required })
    .from(collectItems)
    .where(eq(collectItems.taskId, params.taskId));
  const itemTitleMap = new Map(itemRows.map((i) => [i.id, i.title] as const));
  const requiredItemIds = itemRows.filter((i) => i.required).map((i) => i.id);

  const where = [eq(collectSubmissions.taskId, params.taskId), sql`${collectSubmissions.withdrawnAt} is null`];
  if (!params.filters.includeUnsubmitted) where.push(sql`${collectSubmissions.submittedAt} is not null`);
  if (params.filters.status) where.push(eq(collectSubmissions.status, params.filters.status));
  if (params.filters.from) where.push(sql`${collectSubmissions.submittedAt} >= ${params.filters.from.toISOString()}`);
  if (params.filters.to) where.push(sql`${collectSubmissions.submittedAt} <= ${params.filters.to.toISOString()}`);
  if (params.filters.q && params.filters.q.trim()) {
    const pattern = `%${params.filters.q.trim()}%`;
    where.push(or(sql`${profiles.name} ilike ${pattern}`, sql`${profiles.studentId} ilike ${pattern}`)!);
  }
  if (params.filters.departmentId) {
    const sub = db
      .select({ userId: userDepartments.userId })
      .from(userDepartments)
      .innerJoin(departmentClosure, eq(departmentClosure.descendantId, userDepartments.departmentId))
      .where(eq(departmentClosure.ancestorId, params.filters.departmentId));
    where.push(inArray(collectSubmissions.userId, sub));
  }

  const missingCond = sql<boolean>`exists (
    select 1 from public.collect_items i
    where i.task_id = ${params.taskId} and i.required = true
      and not exists (
        select 1 from public.collect_submission_files f
        where f.submission_id = ${collectSubmissions.id} and f.item_id = i.id
      )
  )`;
  if (typeof params.filters.missingRequired === "boolean") {
    where.push(params.filters.missingRequired ? missingCond : sql`not (${missingCond})`);
  }

  const submissions = await db
    .select({
      id: collectSubmissions.id,
      userId: collectSubmissions.userId,
      submittedAt: collectSubmissions.submittedAt,
      status: collectSubmissions.status,
      missingRequired: missingCond,
      name: profiles.name,
      studentId: profiles.studentId,
    })
    .from(collectSubmissions)
    .innerJoin(profiles, eq(profiles.id, collectSubmissions.userId))
    .where(and(...where))
    .orderBy(desc(collectSubmissions.submittedAt), desc(collectSubmissions.updatedAt));

  const submissionIds = submissions.map((s) => s.id);
  const files =
    submissionIds.length === 0
      ? []
      : await db
          .select({
            id: collectSubmissionFiles.id,
            submissionId: collectSubmissionFiles.submissionId,
            itemId: collectSubmissionFiles.itemId,
            fileKey: collectSubmissionFiles.fileKey,
            fileName: collectSubmissionFiles.fileName,
            contentType: collectSubmissionFiles.contentType,
            size: collectSubmissionFiles.size,
            createdAt: collectSubmissionFiles.createdAt,
          })
          .from(collectSubmissionFiles)
          .where(inArray(collectSubmissionFiles.submissionId, submissionIds))
          .orderBy(asc(collectSubmissionFiles.submissionId), asc(collectSubmissionFiles.sort), asc(collectSubmissionFiles.createdAt));

  const totalBytes = files.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
  if (totalBytes > MAX_EXPORT_ZIP_BYTES) {
    throw badRequest("导出体量过大，请缩小过滤范围后重试", {
      totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
      limitMB: Number((MAX_EXPORT_ZIP_BYTES / (1024 * 1024)).toFixed(2)),
    });
  }

  const userIds = [...new Set(submissions.map((s) => s.userId))];
  const deptRows =
    userIds.length === 0
      ? []
      : await db
          .select({ userId: userDepartments.userId, name: departments.name })
          .from(userDepartments)
          .innerJoin(departments, eq(departments.id, userDepartments.departmentId))
          .where(inArray(userDepartments.userId, userIds))
          .orderBy(asc(departments.name));

  const deptMap = new Map<string, string[]>();
  for (const r of deptRows) {
    const list = deptMap.get(r.userId) ?? [];
    list.push(r.name);
    deptMap.set(r.userId, list);
  }

  const fileBySubmission = new Map<string, typeof files>();
  for (const f of files) {
    const list = fileBySubmission.get(f.submissionId) ?? [];
    list.push(f);
    fileBySubmission.set(f.submissionId, list);
  }

  const missingItemsBySubmission = new Map<string, string[]>();
  if (requiredItemIds.length > 0) {
    const requiredFileRows =
      submissionIds.length === 0
        ? []
        : await db
            .select({ submissionId: collectSubmissionFiles.submissionId, itemId: collectSubmissionFiles.itemId })
            .from(collectSubmissionFiles)
            .where(and(inArray(collectSubmissionFiles.submissionId, submissionIds), inArray(collectSubmissionFiles.itemId, requiredItemIds)));

    const provided = new Map<string, Set<string>>();
    for (const r of requiredFileRows) {
      const set = provided.get(r.submissionId) ?? new Set<string>();
      set.add(r.itemId);
      provided.set(r.submissionId, set);
    }

    for (const s of submissions) {
      const set = provided.get(s.id) ?? new Set<string>();
      const missing = requiredItemIds.filter((id) => !set.has(id)).map((id) => itemTitleMap.get(id) ?? id);
      missingItemsBySubmission.set(s.id, missing);
    }
  }

  const manifest = buildManifestCsv({
    rows: submissions.map((s) => {
      const list = fileBySubmission.get(s.id) ?? [];
      const sum = list.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
      return {
        studentId: s.studentId,
        name: s.name,
        departments: deptMap.get(s.userId) ?? [],
        submittedAt: s.submittedAt,
        status: s.status as CollectSubmissionStatus,
        missingRequired: !!s.missingRequired,
        missingRequiredItems: missingItemsBySubmission.get(s.id) ?? [],
        fileCount: list.length,
        totalBytes: sum,
      };
    }),
  });

  const submissionMap = new Map(submissions.map((s) => [s.id, s] as const));
  const fileName = `${task.title}-材料.zip`;

  return {
    fileName,
    manifest,
    entries: files
      .map((f) => {
        const s = submissionMap.get(f.submissionId);
        if (!s) return null;
        const itemTitle = itemTitleMap.get(f.itemId) ?? f.itemId;
        return {
          id: f.id,
          fileKey: f.fileKey,
          fileName: f.fileName,
          size: f.size,
          path: buildZipPath({ studentId: s.studentId, name: s.name, itemTitle, fileName: f.fileName }),
        };
      })
      .filter(Boolean) as Array<{ id: string; fileKey: string; fileName: string; size: number; path: string }>,
  };
}

export async function streamCollectZip(params: {
  config: CollectModuleConfig;
  fileName: string;
  manifest: string;
  entries: Array<{ fileKey: string; path: string; fileName: string }>;
}) {
  const archiver = (await import("archiver")).default;
  const archive = archiver("zip", { zlib: { level: 0 } });

  archive.append(params.manifest, { name: "manifest.csv" });

  for (const entry of params.entries) {
    const signed = await storageAdapter.createSignedDownloadUrl({
      bucket: params.config.submissionBucket,
      key: entry.fileKey,
      expiresIn: SIGNED_URL_EXPIRES_IN,
      download: entry.fileName ?? true,
    });

    const res = await fetch(signed.signedUrl);
    if (!res.ok || !res.body) continue;
    archive.append(Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>), { name: entry.path });
  }

  archive.finalize().catch(() => {});

  return { fileName: params.fileName, archive };
}
