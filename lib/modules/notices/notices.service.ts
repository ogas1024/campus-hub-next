import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { hasPerm } from "@/lib/auth/permissions";
import { badRequest, conflict, forbidden, notFound } from "@/lib/http/errors";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  departments,
  noticeAttachments,
  noticeReads,
  noticeScopes,
  notices,
  positions,
  profiles,
  roles,
  userPositions,
  userRoles,
} from "@campus-hub/db";

type AudienceContext = {
  roleIds: string[];
  departmentId: string | null;
  positionIds: string[];
};

type NoticeScopeInput = { scopeType: "role" | "department" | "position"; refId: string };
type NoticeAttachmentInput = {
  fileKey: string;
  fileName: string;
  contentType: string;
  size: number;
  sort: number;
};

const NOTICE_ATTACHMENTS_BUCKET = "notice-attachments";
const SIGNED_URL_EXPIRES_IN = 60;

function assertNoInlineHtml(contentMd: string) {
  const stripped = contentMd
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .trim();

  if (/<\/?[a-z][^>]*>/i.test(stripped)) {
    throw badRequest("正文不允许包含内联 HTML（请使用纯 Markdown）");
  }
}

async function getAudienceContext(userId: string): Promise<AudienceContext> {
  const roleRows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  const profileRow = await db
    .select({ departmentId: profiles.departmentId })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  const positionRows = await db
    .select({ positionId: userPositions.positionId })
    .from(userPositions)
    .where(eq(userPositions.userId, userId));

  return {
    roleIds: roleRows.map((r) => r.roleId),
    departmentId: profileRow[0]?.departmentId ?? null,
    positionIds: positionRows.map((p) => p.positionId),
  };
}

async function getVisibleNoticeIdsForUser(ctx: AudienceContext): Promise<string[]> {
  const noticeIdSet = new Set<string>();

  if (ctx.roleIds.length > 0) {
    const rows = await db
      .select({ noticeId: noticeScopes.noticeId })
      .from(noticeScopes)
      .where(and(eq(noticeScopes.scopeType, "role"), inArray(noticeScopes.refId, ctx.roleIds)));
    for (const r of rows) noticeIdSet.add(r.noticeId);
  }

  if (ctx.departmentId) {
    const rows = await db
      .select({ noticeId: noticeScopes.noticeId })
      .from(noticeScopes)
      .where(and(eq(noticeScopes.scopeType, "department"), eq(noticeScopes.refId, ctx.departmentId)));
    for (const r of rows) noticeIdSet.add(r.noticeId);
  }

  if (ctx.positionIds.length > 0) {
    const rows = await db
      .select({ noticeId: noticeScopes.noticeId })
      .from(noticeScopes)
      .where(and(eq(noticeScopes.scopeType, "position"), inArray(noticeScopes.refId, ctx.positionIds)));
    for (const r of rows) noticeIdSet.add(r.noticeId);
  }

  return [...noticeIdSet];
}

function isExpired(expireAt: Date | null, now: Date) {
  return !!expireAt && expireAt.getTime() <= now.getTime();
}

function buildVisibilityCondition(visibleNoticeIds: string[]) {
  if (visibleNoticeIds.length === 0) return eq(notices.visibleAll, true);
  return or(eq(notices.visibleAll, true), inArray(notices.id, visibleNoticeIds));
}

export async function listPortalNotices(params: {
  userId: string;
  page: number;
  pageSize: number;
  q?: string;
  includeExpired: boolean;
  read?: boolean;
  sortBy: "publishAt" | "updatedAt" | "expireAt";
  sortOrder: "asc" | "desc";
}) {
  const now = new Date();
  const ctx = await getAudienceContext(params.userId);
  const visibleIds = await getVisibleNoticeIdsForUser(ctx);
  const manageAll = await hasPerm(params.userId, "campus:notice:manage");

  const baseWhere = [isNull(notices.deletedAt), eq(notices.status, "published")];
  if (!manageAll) {
    baseWhere.push(or(eq(notices.createdBy, params.userId), buildVisibilityCondition(visibleIds))!);
  }

  if (!params.includeExpired) {
    baseWhere.push(or(isNull(notices.expireAt), sql`${notices.expireAt} > now()`)!);
  }

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    baseWhere.push(sql`${notices.title} ilike ${pattern}`);
  }

  const joinOn = and(eq(noticeReads.noticeId, notices.id), eq(noticeReads.userId, params.userId));

  if (params.read === true) {
    baseWhere.push(sql`${noticeReads.noticeId} is not null`);
  }
  if (params.read === false) {
    baseWhere.push(sql`${noticeReads.noticeId} is null`);
  }

  const offset = (params.page - 1) * params.pageSize;

  const sortCol =
    params.sortBy === "publishAt"
      ? notices.publishAt
      : params.sortBy === "expireAt"
        ? notices.expireAt
        : notices.updatedAt;

  const sortExpr = params.sortOrder === "asc" ? sql`${sortCol} asc nulls last` : sql`${sortCol} desc nulls last`;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(notices)
    .leftJoin(noticeReads, joinOn)
    .where(and(...baseWhere));

  const rows = await db
    .select({
      id: notices.id,
      title: notices.title,
      status: notices.status,
      visibleAll: notices.visibleAll,
      pinned: notices.pinned,
      pinnedAt: notices.pinnedAt,
      publishAt: notices.publishAt,
      expireAt: notices.expireAt,
      createdBy: notices.createdBy,
      createdAt: notices.createdAt,
      updatedAt: notices.updatedAt,
      editCount: notices.editCount,
      readCount: notices.readCount,
      readAt: noticeReads.readAt,
    })
    .from(notices)
    .leftJoin(noticeReads, joinOn)
    .where(and(...baseWhere))
    .orderBy(desc(notices.pinned), desc(notices.pinnedAt), sortExpr)
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      visibleAll: r.visibleAll,
      pinned: r.pinned,
      pinnedAt: r.pinnedAt,
      publishAt: r.publishAt,
      expireAt: r.expireAt,
      isExpired: isExpired(r.expireAt, now),
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      editCount: r.editCount,
      readCount: r.readCount,
      read: !!r.readAt,
    })),
  };
}

export async function getPortalNoticeDetail(params: { userId: string; noticeId: string }) {
  const now = new Date();
  const ctx = await getAudienceContext(params.userId);
  const visibleIds = await getVisibleNoticeIdsForUser(ctx);
  const manageAll = await hasPerm(params.userId, "campus:notice:manage");
  const visibility = buildVisibilityCondition(visibleIds);

  const joinOn = and(eq(noticeReads.noticeId, notices.id), eq(noticeReads.userId, params.userId));

  const rows = await db
    .select({
      id: notices.id,
      title: notices.title,
      contentMd: notices.contentMd,
      status: notices.status,
      visibleAll: notices.visibleAll,
      pinned: notices.pinned,
      pinnedAt: notices.pinnedAt,
      publishAt: notices.publishAt,
      expireAt: notices.expireAt,
      createdBy: notices.createdBy,
      createdAt: notices.createdAt,
      updatedBy: notices.updatedBy,
      updatedAt: notices.updatedAt,
      editCount: notices.editCount,
      readCount: notices.readCount,
      readAt: noticeReads.readAt,
    })
    .from(notices)
    .leftJoin(noticeReads, joinOn)
    .where(
      and(
        eq(notices.id, params.noticeId),
        isNull(notices.deletedAt),
        manageAll
          ? sql`true`
          : or(
              eq(notices.createdBy, params.userId),
              and(eq(notices.status, "published"), visibility),
            ),
      ),
    )
    .limit(1);

  const notice = rows[0];
  if (!notice) throw notFound();

  const scopes = await db
    .select({ scopeType: noticeScopes.scopeType, refId: noticeScopes.refId })
    .from(noticeScopes)
    .where(eq(noticeScopes.noticeId, notice.id));

  const attachments = await db
    .select({
      id: noticeAttachments.id,
      fileKey: noticeAttachments.fileKey,
      fileName: noticeAttachments.fileName,
      contentType: noticeAttachments.contentType,
      size: noticeAttachments.size,
    })
    .from(noticeAttachments)
    .where(eq(noticeAttachments.noticeId, notice.id))
    .orderBy(asc(noticeAttachments.sort), asc(noticeAttachments.createdAt));

  const supabase = createSupabaseAdminClient();
  const signed = await Promise.all(
    attachments.map(async (a) => {
      const { data, error } = await supabase.storage
        .from(NOTICE_ATTACHMENTS_BUCKET)
        .createSignedUrl(a.fileKey, SIGNED_URL_EXPIRES_IN);
      if (error || !data?.signedUrl) return { ...a, downloadUrl: null };
      return { ...a, downloadUrl: data.signedUrl };
    }),
  );

  return {
    id: notice.id,
    title: notice.title,
    contentMd: notice.contentMd,
    status: notice.status,
    visibleAll: notice.visibleAll,
    scopes,
    pinned: notice.pinned,
    pinnedAt: notice.pinnedAt,
    publishAt: notice.publishAt,
    expireAt: notice.expireAt,
    isExpired: isExpired(notice.expireAt, now),
    createdBy: notice.createdBy,
    createdAt: notice.createdAt,
    updatedBy: notice.updatedBy,
    updatedAt: notice.updatedAt,
    editCount: notice.editCount,
    readCount: notice.readCount,
    read: !!notice.readAt,
    attachments: signed.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      contentType: a.contentType,
      size: a.size,
      downloadUrl: a.downloadUrl,
    })),
  };
}

export async function markNoticeRead(params: { userId: string; noticeId: string }) {
  const ctx = await getAudienceContext(params.userId);
  const visibleIds = await getVisibleNoticeIdsForUser(ctx);
  const visibility = buildVisibilityCondition(visibleIds);
  const manageAll = await hasPerm(params.userId, "campus:notice:manage");

  const exists = await db
    .select({ id: notices.id })
    .from(notices)
    .where(
      and(
        eq(notices.id, params.noticeId),
        isNull(notices.deletedAt),
        eq(notices.status, "published"),
        manageAll ? sql`true` : or(eq(notices.createdBy, params.userId), visibility),
      ),
    )
    .limit(1);
  if (!exists[0]) throw notFound();

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(noticeReads)
      .values({ noticeId: params.noticeId, userId: params.userId })
      .onConflictDoNothing()
      .returning({ noticeId: noticeReads.noticeId });

    if (inserted.length > 0) {
      await tx
        .update(notices)
        .set({ readCount: sql`${notices.readCount} + 1` })
        .where(eq(notices.id, params.noticeId));
    }
  });

  return { ok: true };
}

async function canManageAllNotices(userId: string) {
  return hasPerm(userId, "campus:notice:manage");
}

async function assertCanOperateNotice(userId: string, noticeId: string) {
  if (await canManageAllNotices(userId)) return;

  const row = await db
    .select({ id: notices.id })
    .from(notices)
    .where(and(eq(notices.id, noticeId), eq(notices.createdBy, userId), isNull(notices.deletedAt)))
    .limit(1);

  if (!row[0]) throw forbidden("只能操作自己创建的公告");
}

export async function listConsoleNotices(params: {
  userId: string;
  page: number;
  pageSize: number;
  q?: string;
  includeExpired: boolean;
  status?: "draft" | "published" | "retracted";
  mine: boolean;
}) {
  const now = new Date();
  const manageAll = await canManageAllNotices(params.userId);
  const mustMine = params.mine || !manageAll;

  const baseWhere = [isNull(notices.deletedAt)];

  if (mustMine) baseWhere.push(eq(notices.createdBy, params.userId));
  if (params.status) baseWhere.push(eq(notices.status, params.status));

  if (!params.includeExpired) {
    baseWhere.push(or(isNull(notices.expireAt), sql`${notices.expireAt} > now()`)!);
  }

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    baseWhere.push(sql`${notices.title} ilike ${pattern}`);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(notices)
    .where(and(...baseWhere));

  const rows = await db
    .select({
      id: notices.id,
      title: notices.title,
      status: notices.status,
      visibleAll: notices.visibleAll,
      pinned: notices.pinned,
      pinnedAt: notices.pinnedAt,
      publishAt: notices.publishAt,
      expireAt: notices.expireAt,
      createdBy: notices.createdBy,
      createdAt: notices.createdAt,
      updatedAt: notices.updatedAt,
      editCount: notices.editCount,
      readCount: notices.readCount,
    })
    .from(notices)
    .where(and(...baseWhere))
    .orderBy(desc(notices.pinned), desc(notices.pinnedAt), desc(notices.updatedAt))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      visibleAll: r.visibleAll,
      pinned: r.pinned,
      pinnedAt: r.pinnedAt,
      publishAt: r.publishAt,
      expireAt: r.expireAt,
      isExpired: isExpired(r.expireAt, now),
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      editCount: r.editCount,
      readCount: r.readCount,
      read: null,
    })),
  };
}

export async function getConsoleNoticeDetail(params: { userId: string; noticeId: string }) {
  await assertCanOperateNotice(params.userId, params.noticeId);

  const now = new Date();
  const row = await db
    .select({
      id: notices.id,
      title: notices.title,
      contentMd: notices.contentMd,
      status: notices.status,
      visibleAll: notices.visibleAll,
      pinned: notices.pinned,
      pinnedAt: notices.pinnedAt,
      publishAt: notices.publishAt,
      expireAt: notices.expireAt,
      createdBy: notices.createdBy,
      createdAt: notices.createdAt,
      updatedBy: notices.updatedBy,
      updatedAt: notices.updatedAt,
      editCount: notices.editCount,
      readCount: notices.readCount,
    })
    .from(notices)
    .where(and(eq(notices.id, params.noticeId), isNull(notices.deletedAt)))
    .limit(1);

  const notice = row[0];
  if (!notice) throw notFound();

  const scopes = await db
    .select({ scopeType: noticeScopes.scopeType, refId: noticeScopes.refId })
    .from(noticeScopes)
    .where(eq(noticeScopes.noticeId, notice.id));

  const attachments = await db
    .select({
      id: noticeAttachments.id,
      fileKey: noticeAttachments.fileKey,
      fileName: noticeAttachments.fileName,
      contentType: noticeAttachments.contentType,
      size: noticeAttachments.size,
      sort: noticeAttachments.sort,
    })
    .from(noticeAttachments)
    .where(eq(noticeAttachments.noticeId, notice.id))
    .orderBy(asc(noticeAttachments.sort), asc(noticeAttachments.createdAt));

  return {
    id: notice.id,
    title: notice.title,
    contentMd: notice.contentMd,
    status: notice.status,
    visibleAll: notice.visibleAll,
    scopes,
    pinned: notice.pinned,
    pinnedAt: notice.pinnedAt,
    publishAt: notice.publishAt,
    expireAt: notice.expireAt,
    isExpired: isExpired(notice.expireAt, now),
    createdBy: notice.createdBy,
    createdAt: notice.createdAt,
    updatedBy: notice.updatedBy,
    updatedAt: notice.updatedAt,
    editCount: notice.editCount,
    readCount: notice.readCount,
    read: null,
    attachments: attachments.map((a) => ({
      id: a.id,
      fileKey: a.fileKey,
      fileName: a.fileName,
      contentType: a.contentType,
      size: a.size,
      sort: a.sort,
    })),
  };
}

export async function createNotice(params: {
  userId: string;
  title: string;
  contentMd: string;
  expireAt?: Date;
  visibleAll: boolean;
  scopes: NoticeScopeInput[];
  attachments: NoticeAttachmentInput[];
}) {
  assertNoInlineHtml(params.contentMd);

  if (!params.visibleAll && params.scopes.length === 0) {
    throw badRequest("visibleAll=false 时必须至少配置 1 条 scope");
  }

  const noticeId = await db.transaction(async (tx) => {
    const now = new Date();

    const inserted = await tx
      .insert(notices)
      .values({
        title: params.title,
        contentMd: params.contentMd,
        expireAt: params.expireAt,
        visibleAll: params.visibleAll,
        status: "draft",
        pinned: false,
        pinnedAt: null,
        publishAt: null,
        createdBy: params.userId,
        updatedBy: null,
        editCount: 0,
        readCount: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      .returning({ id: notices.id });

    const createdId = inserted[0]?.id;
    if (!createdId) throw badRequest("创建公告失败");

    if (!params.visibleAll) {
      await tx.insert(noticeScopes).values(
        params.scopes.map((s) => ({
          noticeId: createdId,
          scopeType: s.scopeType,
          refId: s.refId,
        })),
      );
    }

    if (params.attachments.length > 0) {
      await tx.insert(noticeAttachments).values(
        params.attachments.map((a, index) => ({
          noticeId: createdId,
          fileKey: a.fileKey,
          fileName: a.fileName,
          contentType: a.contentType,
          size: a.size,
          sort: index,
        })),
      );
    }

    return createdId;
  });

  return getConsoleNoticeDetail({ userId: params.userId, noticeId });
}

export async function updateNotice(params: {
  userId: string;
  noticeId: string;
  title: string;
  contentMd: string;
  expireAt?: Date;
  visibleAll: boolean;
  scopes: NoticeScopeInput[];
  attachments: NoticeAttachmentInput[];
}) {
  await assertCanOperateNotice(params.userId, params.noticeId);
  assertNoInlineHtml(params.contentMd);

  if (!params.visibleAll && params.scopes.length === 0) {
    throw badRequest("visibleAll=false 时必须至少配置 1 条 scope");
  }

  await db.transaction(async (tx) => {
    const now = new Date();

    const updated = await tx
      .update(notices)
      .set({
        title: params.title,
        contentMd: params.contentMd,
        expireAt: params.expireAt,
        visibleAll: params.visibleAll,
        updatedBy: params.userId,
        updatedAt: now,
        editCount: sql`${notices.editCount} + 1`,
      })
      .where(and(eq(notices.id, params.noticeId), isNull(notices.deletedAt)))
      .returning({ id: notices.id });

    if (updated.length === 0) throw notFound();

    await tx.delete(noticeScopes).where(eq(noticeScopes.noticeId, params.noticeId));
    await tx.delete(noticeAttachments).where(eq(noticeAttachments.noticeId, params.noticeId));

    if (!params.visibleAll) {
      await tx.insert(noticeScopes).values(
        params.scopes.map((s) => ({
          noticeId: params.noticeId,
          scopeType: s.scopeType,
          refId: s.refId,
        })),
      );
    }

    if (params.attachments.length > 0) {
      await tx.insert(noticeAttachments).values(
        params.attachments.map((a, index) => ({
          noticeId: params.noticeId,
          fileKey: a.fileKey,
          fileName: a.fileName,
          contentType: a.contentType,
          size: a.size,
          sort: index,
        })),
      );
    }
  });

  return getConsoleNoticeDetail({ userId: params.userId, noticeId: params.noticeId });
}

export async function deleteNotice(params: { userId: string; noticeId: string }) {
  await assertCanOperateNotice(params.userId, params.noticeId);

  const now = new Date();
  const updated = await db
    .update(notices)
    .set({ deletedAt: now, updatedBy: params.userId, updatedAt: now })
    .where(and(eq(notices.id, params.noticeId), isNull(notices.deletedAt)))
    .returning({ id: notices.id });

  if (updated.length === 0) throw notFound();
  return { ok: true };
}

export async function publishNotice(params: { userId: string; noticeId: string }) {
  await assertCanOperateNotice(params.userId, params.noticeId);

  const now = new Date();

  const row = await db
    .select({
      status: notices.status,
      expireAt: notices.expireAt,
    })
    .from(notices)
    .where(and(eq(notices.id, params.noticeId), isNull(notices.deletedAt)))
    .limit(1);

  const current = row[0];
  if (!current) throw notFound();

  if (current.status === "published") {
    return getConsoleNoticeDetail({ userId: params.userId, noticeId: params.noticeId });
  }

  if (current.expireAt && current.expireAt.getTime() <= now.getTime()) {
    throw badRequest("expireAt 必须大于 publishAt（当前时间）");
  }

  await db
    .update(notices)
    .set({
      status: "published",
      publishAt: now,
      pinned: false,
      pinnedAt: null,
      updatedBy: params.userId,
      updatedAt: now,
    })
    .where(and(eq(notices.id, params.noticeId), isNull(notices.deletedAt)));

  return getConsoleNoticeDetail({ userId: params.userId, noticeId: params.noticeId });
}

export async function retractNotice(params: { userId: string; noticeId: string }) {
  await assertCanOperateNotice(params.userId, params.noticeId);

  const now = new Date();
  const row = await db
    .select({ status: notices.status })
    .from(notices)
    .where(and(eq(notices.id, params.noticeId), isNull(notices.deletedAt)))
    .limit(1);

  const current = row[0];
  if (!current) throw notFound();

  if (current.status === "retracted") {
    return getConsoleNoticeDetail({ userId: params.userId, noticeId: params.noticeId });
  }

  if (current.status !== "published") {
    throw conflict("仅已发布公告允许撤回");
  }

  await db
    .update(notices)
    .set({
      status: "retracted",
      pinned: false,
      pinnedAt: null,
      updatedBy: params.userId,
      updatedAt: now,
    })
    .where(and(eq(notices.id, params.noticeId), isNull(notices.deletedAt)));

  return getConsoleNoticeDetail({ userId: params.userId, noticeId: params.noticeId });
}

export async function setNoticePinned(params: { userId: string; noticeId: string; pinned: boolean }) {
  await assertCanOperateNotice(params.userId, params.noticeId);

  const now = new Date();
  const row = await db
    .select({
      status: notices.status,
      expireAt: notices.expireAt,
      pinned: notices.pinned,
    })
    .from(notices)
    .where(and(eq(notices.id, params.noticeId), isNull(notices.deletedAt)))
    .limit(1);

  const current = row[0];
  if (!current) throw notFound();

  if (params.pinned) {
    if (current.status !== "published") throw conflict("仅已发布公告允许置顶");
    if (isExpired(current.expireAt, now)) throw conflict("已过期公告不允许置顶");
    if (current.pinned) return getConsoleNoticeDetail({ userId: params.userId, noticeId: params.noticeId });
  } else {
    if (!current.pinned) return getConsoleNoticeDetail({ userId: params.userId, noticeId: params.noticeId });
  }

  await db
    .update(notices)
    .set({
      pinned: params.pinned,
      pinnedAt: params.pinned ? now : null,
      updatedBy: params.userId,
      updatedAt: now,
    })
    .where(and(eq(notices.id, params.noticeId), isNull(notices.deletedAt)));

  return getConsoleNoticeDetail({ userId: params.userId, noticeId: params.noticeId });
}

export async function uploadNoticeAttachment(params: {
  userId: string;
  noticeId: string;
  file: File;
}) {
  await assertCanOperateNotice(params.userId, params.noticeId);

  if (params.file.size <= 0) throw badRequest("文件为空");
  if (params.file.size > 20 * 1024 * 1024) throw badRequest("文件过大（最大 20MB）");

  const safeName = params.file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 80);
  const objectKey = `notices/${params.noticeId}/${crypto.randomUUID()}-${safeName}`;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(NOTICE_ATTACHMENTS_BUCKET).upload(objectKey, params.file, {
    contentType: params.file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw badRequest("上传失败", { message: error.message });

  return {
    id: crypto.randomUUID(),
    fileKey: objectKey,
    fileName: params.file.name,
    contentType: params.file.type || "application/octet-stream",
    size: params.file.size,
  };
}

export async function getNoticeScopeOptions() {
  const [roleRows, deptRows, positionRows] = await Promise.all([
    db.select({ id: roles.id, name: roles.name, code: roles.code }).from(roles).orderBy(desc(roles.updatedAt)),
    db
      .select({ id: departments.id, name: departments.name, parentId: departments.parentId })
      .from(departments)
      .orderBy(desc(departments.updatedAt)),
    db.select({ id: positions.id, name: positions.name }).from(positions).orderBy(desc(positions.updatedAt)),
  ]);

  return {
    roles: roleRows.map((r) => ({ id: r.id, name: r.name, code: r.code })),
    departments: deptRows.map((d) => ({ id: d.id, name: d.name, parentId: d.parentId })),
    positions: positionRows.map((p) => ({ id: p.id, name: p.name })),
  };
}
