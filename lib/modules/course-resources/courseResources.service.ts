import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { hasPerm } from "@/lib/auth/permissions";
import { HttpError, badRequest, conflict, notFound } from "@/lib/http/errors";
import type { RequestContext } from "@/lib/http/route";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import { writeAuditLog } from "@/lib/modules/audit/audit.service";
import { COURSE_RESOURCES_BUCKET, normalizeExternalUrl, sanitizeFileName } from "@/lib/modules/course-resources/courseResources.utils";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  appConfig,
  authUsers,
  courseResourceBests,
  courseResourceDownloadEvents,
  courseResourceScoreEvents,
  courseResources,
  courses,
  majorLeads,
  majors,
  profiles,
} from "@campus-hub/db";

type ResourceStatus = "draft" | "pending" | "published" | "rejected" | "unpublished";
type ResourceType = "file" | "link";

const SIGNED_URL_EXPIRES_IN = 60;
const DEFAULT_APPROVE_DELTA = 5;
const DEFAULT_BEST_DELTA = 10;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requireUuid(value: string, name: string) {
  if (!value || !isUuid(value)) throw badRequest(`${name} 必须为 UUID`);
  return value;
}

function toErrorCode(err: unknown) {
  return err instanceof HttpError ? err.code : "INTERNAL_ERROR";
}

function getStorageErrorMeta(err: unknown): { status?: number; message: string } {
  const e = err as { status?: number; statusCode?: string | number; message?: string } | null;
  const status =
    typeof e?.status === "number"
      ? e.status
      : typeof e?.statusCode === "number"
        ? e.statusCode
        : typeof e?.statusCode === "string"
          ? Number(e.statusCode)
          : undefined;
  const message = e?.message ? String(e.message) : "未知错误";
  return { status, message };
}

async function canManageAllResources(userId: string) {
  return hasPerm(userId, "campus:resource:*");
}

async function getScopedMajorIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ majorId: majorLeads.majorId })
    .from(majorLeads)
    .innerJoin(majors, eq(majors.id, majorLeads.majorId))
    .where(and(eq(majorLeads.userId, userId), isNull(majors.deletedAt)))
    .orderBy(asc(majors.sort), asc(majors.name));
  return rows.map((r) => r.majorId);
}

async function getConfigNumber(key: string, defaultValue: number) {
  const rows = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, key)).limit(1);
  const raw = rows[0]?.value;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return defaultValue;
}

async function ensureMajorExists(majorId: string) {
  const rows = await db.select({ id: majors.id }).from(majors).where(and(eq(majors.id, majorId), isNull(majors.deletedAt))).limit(1);
  if (!rows[0]) throw notFound("专业不存在或不可见");
}

async function ensureCourseExists(params: { courseId: string; majorId?: string }) {
  const where = [eq(courses.id, params.courseId), isNull(courses.deletedAt)];
  if (params.majorId) where.push(eq(courses.majorId, params.majorId));
  const rows = await db.select({ id: courses.id, majorId: courses.majorId }).from(courses).where(and(...where)).limit(1);
  const row = rows[0];
  if (!row) throw notFound("课程不存在或不可见");
  return row;
}

async function ensureConsoleMajorScope(params: { actorUserId: string; majorId: string }) {
  const manageAll = await canManageAllResources(params.actorUserId);
  if (manageAll) return;

  const allowed = await getScopedMajorIds(params.actorUserId);
  if (allowed.includes(params.majorId)) return;
  throw notFound("专业不存在或不可见");
}

async function ensureConsoleResourceScope(params: { actorUserId: string; resourceId: string }) {
  const manageAll = await canManageAllResources(params.actorUserId);
  if (manageAll) {
    const rows = await db
      .select({ majorId: courseResources.majorId })
      .from(courseResources)
      .where(and(eq(courseResources.id, params.resourceId), isNull(courseResources.deletedAt)))
      .limit(1);
    const row = rows[0];
    if (!row) throw notFound();
    return row.majorId;
  }

  const allowed = await getScopedMajorIds(params.actorUserId);
  if (allowed.length === 0) throw notFound();

  const rows = await db
    .select({ majorId: courseResources.majorId })
    .from(courseResources)
    .where(
      and(
        eq(courseResources.id, params.resourceId),
        isNull(courseResources.deletedAt),
        inArray(courseResources.majorId, allowed),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound();
  return row.majorId;
}

function buildResourceListItem(row: {
  id: string;
  majorId: string;
  courseId: string;
  title: string;
  description: string;
  resourceType: ResourceType;
  status: ResourceStatus;
  downloadCount: number;
  isBest: boolean;
  publishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    majorId: row.majorId,
    courseId: row.courseId,
    title: row.title,
    description: row.description,
    resourceType: row.resourceType,
    status: row.status,
    downloadCount: row.downloadCount,
    isBest: row.isBest,
    publishedAt: row.publishedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

async function getResourceDetailBase(resourceId: string) {
  const rows = await db
    .select({
      id: courseResources.id,
      majorId: courseResources.majorId,
      courseId: courseResources.courseId,
      title: courseResources.title,
      description: courseResources.description,
      resourceType: courseResources.resourceType,
      status: courseResources.status,

      fileBucket: courseResources.fileBucket,
      fileKey: courseResources.fileKey,
      fileName: courseResources.fileName,
      fileSize: courseResources.fileSize,
      sha256: courseResources.sha256,

      linkUrl: courseResources.linkUrl,
      linkUrlNormalized: courseResources.linkUrlNormalized,

      submittedAt: courseResources.submittedAt,
      reviewedBy: courseResources.reviewedBy,
      reviewedAt: courseResources.reviewedAt,
      reviewComment: courseResources.reviewComment,
      publishedAt: courseResources.publishedAt,
      unpublishedAt: courseResources.unpublishedAt,

      downloadCount: courseResources.downloadCount,
      lastDownloadAt: courseResources.lastDownloadAt,

      createdBy: courseResources.createdBy,
      createdAt: courseResources.createdAt,
      updatedBy: courseResources.updatedBy,
      updatedAt: courseResources.updatedAt,
      deletedAt: courseResources.deletedAt,

      isBest: sql<boolean>`(${courseResourceBests.resourceId} is not null)`.as("isBest"),
    })
    .from(courseResources)
    .leftJoin(courseResourceBests, eq(courseResourceBests.resourceId, courseResources.id))
    .where(and(eq(courseResources.id, resourceId), isNull(courseResources.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound();
  return row;
}

export async function listPortalMajors() {
  const rows = await db
    .select({ id: majors.id, name: majors.name, enabled: majors.enabled, sort: majors.sort })
    .from(majors)
    .where(and(isNull(majors.deletedAt), eq(majors.enabled, true)))
    .orderBy(asc(majors.sort), asc(majors.name));

  return rows;
}

export async function listPortalCourses(params: { userId: string; majorId: string }) {
  requireUuid(params.majorId, "majorId");

  const rows = await db
    .select({
      id: courses.id,
      majorId: courses.majorId,
      name: courses.name,
      code: courses.code,
      enabled: courses.enabled,
      sort: courses.sort,
    })
    .from(courses)
    .where(and(isNull(courses.deletedAt), eq(courses.enabled, true), eq(courses.majorId, params.majorId)))
    .orderBy(asc(courses.sort), asc(courses.name));

  return rows;
}

export async function listPortalResources(params: {
  userId: string;
  courseId: string;
  page: number;
  pageSize: number;
  q?: string;
}) {
  requireUuid(params.courseId, "courseId");

  const where = [isNull(courseResources.deletedAt), eq(courseResources.status, "published"), eq(courseResources.courseId, params.courseId)];
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    where.push(or(sql`${courseResources.title} ilike ${pattern}`, sql`${courseResources.description} ilike ${pattern}`)!);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(courseResources)
    .where(and(...where));

  const rows = await db
    .select({
      id: courseResources.id,
      majorId: courseResources.majorId,
      courseId: courseResources.courseId,
      title: courseResources.title,
      description: courseResources.description,
      resourceType: courseResources.resourceType,
      status: courseResources.status,
      downloadCount: courseResources.downloadCount,
      publishedAt: courseResources.publishedAt,
      createdBy: courseResources.createdBy,
      createdAt: courseResources.createdAt,
      isBest: sql<boolean>`(${courseResourceBests.resourceId} is not null)`.as("isBest"),
    })
    .from(courseResources)
    .leftJoin(courseResourceBests, eq(courseResourceBests.resourceId, courseResources.id))
    .where(and(...where))
    .orderBy(
      desc(sql`(${courseResourceBests.resourceId} is not null)`),
      desc(courseResources.downloadCount),
      desc(courseResources.publishedAt),
      desc(courseResources.createdAt),
    )
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => buildResourceListItem({ ...r, isBest: !!r.isBest })),
  };
}

export async function getPortalResourceDetail(params: { userId: string; resourceId: string }) {
  requireUuid(params.resourceId, "id");

  const row = await getResourceDetailBase(params.resourceId);
  if (row.status !== "published") throw notFound();

  return {
    id: row.id,
    majorId: row.majorId,
    courseId: row.courseId,
    title: row.title,
    description: row.description,
    resourceType: row.resourceType,
    status: row.status,
    file: row.resourceType === "file" && row.fileBucket && row.fileKey && row.fileName && row.fileSize && row.sha256
      ? {
          bucket: row.fileBucket,
          key: row.fileKey,
          fileName: row.fileName,
          size: row.fileSize,
          sha256: row.sha256,
          downloadUrl: null,
        }
      : null,
    link: row.resourceType === "link" && row.linkUrl && row.linkUrlNormalized
      ? { url: row.linkUrl, normalizedUrl: row.linkUrlNormalized }
      : null,
    review: {
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      comment: row.reviewComment,
    },
    publishedAt: row.publishedAt,
    unpublishedAt: row.unpublishedAt,
    downloadCount: row.downloadCount,
    isBest: !!row.isBest,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export async function downloadPortalResource(params: { userId: string; resourceId: string; request: RequestContext }) {
  requireUuid(params.resourceId, "id");

  const row = await getResourceDetailBase(params.resourceId);
  if (row.status !== "published") throw notFound();

  await db.transaction(async (tx) => {
    await tx.insert(courseResourceDownloadEvents).values({
      resourceId: row.id,
      userId: params.userId,
      ip: params.request.ip,
      userAgent: params.request.userAgent,
    });

    await tx
      .update(courseResources)
      .set({ downloadCount: sql`${courseResources.downloadCount} + 1`, lastDownloadAt: sql`now()` })
      .where(eq(courseResources.id, row.id));
  });

  if (row.resourceType === "link") {
    if (!row.linkUrlNormalized) throw badRequest("外链资源缺少 URL");
    return { redirectUrl: row.linkUrlNormalized };
  }

  if (!row.fileBucket || !row.fileKey) throw badRequest("文件资源缺少文件信息");

  const supabase = createSupabaseAdminClient();
  let data: { signedUrl: string } | null = null;
  let error: unknown = null;
  try {
    const res = await supabase.storage.from(row.fileBucket).createSignedUrl(row.fileKey, SIGNED_URL_EXPIRES_IN, { download: row.fileName ?? true });
    data = res.data;
    error = res.error;
  } catch (err) {
    error = err;
  }
  if (error || !data?.signedUrl) {
    const { status, message } = getStorageErrorMeta(error);
    console.error("[course-resources] createSignedUrl failed", {
      status,
      message,
      bucket: row.fileBucket,
      key: row.fileKey,
      resourceId: row.id,
    });

    if (status === 404 || /not found/i.test(message)) {
      throw new HttpError(
        500,
        "INTERNAL_ERROR",
        "生成下载链接失败：文件不存在或已被移除，请联系专业负责人/管理员下架并要求作者重新提交",
        { status, message },
      );
    }

    if (status === 401 || status === 403) {
      throw new HttpError(
        500,
        "INTERNAL_ERROR",
        "生成下载链接失败：服务端缺少访问存储的权限，请检查 SUPABASE_SERVICE_ROLE_KEY",
        { status, message },
      );
    }

    throw new HttpError(500, "INTERNAL_ERROR", "生成下载链接失败", { status, message });
  }

  return { redirectUrl: data.signedUrl };
}

export async function downloadConsoleResource(params: { actorUserId: string; resourceId: string }) {
  requireUuid(params.resourceId, "id");
  await ensureConsoleResourceScope({ actorUserId: params.actorUserId, resourceId: params.resourceId });

  const row = await getResourceDetailBase(params.resourceId);

  if (row.resourceType === "link") {
    if (!row.linkUrlNormalized) throw badRequest("外链资源缺少 URL");
    return { redirectUrl: row.linkUrlNormalized };
  }

  if (!row.fileBucket || !row.fileKey) throw badRequest("文件资源缺少文件信息");

  const supabase = createSupabaseAdminClient();
  let data: { signedUrl: string } | null = null;
  let error: unknown = null;
  try {
    const res = await supabase.storage.from(row.fileBucket).createSignedUrl(row.fileKey, SIGNED_URL_EXPIRES_IN, { download: row.fileName ?? true });
    data = res.data;
    error = res.error;
  } catch (err) {
    error = err;
  }
  if (error || !data?.signedUrl) {
    const { status, message } = getStorageErrorMeta(error);
    console.error("[course-resources] console createSignedUrl failed", {
      status,
      message,
      bucket: row.fileBucket,
      key: row.fileKey,
      resourceId: row.id,
      actorUserId: params.actorUserId,
    });
    if (status === 404 || /not found/i.test(message) || /object not found/i.test(message)) {
      throw new HttpError(
        500,
        "INTERNAL_ERROR",
        "生成下载链接失败：文件不存在或已被移除，请下架并通知作者重新上传后再提交审核",
        { status, message },
      );
    }
    throw new HttpError(500, "INTERNAL_ERROR", "生成下载链接失败", { status, message });
  }

  return { redirectUrl: data.signedUrl };
}

export async function getPortalResourceDownloadLeaderboard(params: {
  userId: string;
  scope: "global" | "major" | "course";
  days: number;
  majorId?: string;
  courseId?: string;
}) {
  const days = Math.max(1, Math.min(365, Math.trunc(params.days)));
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  if (params.scope === "major") requireUuid(params.majorId ?? "", "majorId");
  if (params.scope === "course") requireUuid(params.courseId ?? "", "courseId");

  const where = [
    isNull(courseResources.deletedAt),
    eq(courseResources.status, "published"),
    sql`${courseResourceDownloadEvents.occurredAt} >= ${from.toISOString()}`,
  ];

  if (params.scope === "major") where.push(eq(courseResources.majorId, params.majorId!));
  if (params.scope === "course") where.push(eq(courseResources.courseId, params.courseId!));

  const top = await db
    .select({
      resourceId: courseResourceDownloadEvents.resourceId,
      windowDownloadCount: sql<number>`count(*)`.as("windowDownloadCount"),
    })
    .from(courseResourceDownloadEvents)
    .innerJoin(courseResources, eq(courseResources.id, courseResourceDownloadEvents.resourceId))
    .where(and(...where))
    .groupBy(courseResourceDownloadEvents.resourceId)
    .orderBy(desc(sql`count(*)`), desc(courseResourceDownloadEvents.resourceId))
    .limit(50);

  const ids = top.map((t) => t.resourceId);
  if (ids.length === 0) return { scope: params.scope, days, items: [] };

  const resourcesRows = await db
    .select({
      id: courseResources.id,
      majorId: courseResources.majorId,
      courseId: courseResources.courseId,
      title: courseResources.title,
      description: courseResources.description,
      resourceType: courseResources.resourceType,
      status: courseResources.status,
      downloadCount: courseResources.downloadCount,
      publishedAt: courseResources.publishedAt,
      createdBy: courseResources.createdBy,
      createdAt: courseResources.createdAt,
      isBest: sql<boolean>`(${courseResourceBests.resourceId} is not null)`.as("isBest"),
    })
    .from(courseResources)
    .leftJoin(courseResourceBests, eq(courseResourceBests.resourceId, courseResources.id))
    .where(inArray(courseResources.id, ids));

  const byId = new Map(resourcesRows.map((r) => [r.id, buildResourceListItem({ ...r, isBest: !!r.isBest })]));

  return {
    scope: params.scope,
    days,
    items: top
      .map((t) => {
        const resource = byId.get(t.resourceId);
        if (!resource) return null;
        return { resource, windowDownloadCount: Number(t.windowDownloadCount ?? 0) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };
}

export async function getPortalUserScoreLeaderboard(params: { userId: string; majorId?: string }) {
  if (params.majorId) requireUuid(params.majorId, "majorId");

  const where = [];
  if (params.majorId) where.push(eq(courseResourceScoreEvents.majorId, params.majorId));

  const rows = await db
    .select({
      userId: courseResourceScoreEvents.userId,
      name: profiles.name,
      score: sql<number>`sum(${courseResourceScoreEvents.delta})`.as("score"),
      approveCount: sql<number>`sum(case when ${courseResourceScoreEvents.eventType} = 'approve' then 1 else 0 end)`.as(
        "approveCount",
      ),
      bestCount: sql<number>`sum(case when ${courseResourceScoreEvents.eventType} = 'best' then 1 else 0 end)`.as(
        "bestCount",
      ),
    })
    .from(courseResourceScoreEvents)
    .innerJoin(profiles, eq(profiles.id, courseResourceScoreEvents.userId))
    .where(where.length > 0 ? and(...where) : undefined)
    .groupBy(courseResourceScoreEvents.userId, profiles.name)
    .orderBy(desc(sql`sum(${courseResourceScoreEvents.delta})`), asc(profiles.name))
    .limit(20);

  const items = await Promise.all(
    rows.map(async (r) => {
      const worksWhere = [
        isNull(courseResources.deletedAt),
        eq(courseResources.status, "published"),
        eq(courseResources.createdBy, r.userId),
      ];
      if (params.majorId) worksWhere.push(eq(courseResources.majorId, params.majorId));

      const topWorksRows = await db
        .select({
          id: courseResources.id,
          majorId: courseResources.majorId,
          courseId: courseResources.courseId,
          title: courseResources.title,
          description: courseResources.description,
          resourceType: courseResources.resourceType,
          status: courseResources.status,
          downloadCount: courseResources.downloadCount,
          publishedAt: courseResources.publishedAt,
          createdBy: courseResources.createdBy,
          createdAt: courseResources.createdAt,
          isBest: sql<boolean>`(${courseResourceBests.resourceId} is not null)`.as("isBest"),
        })
        .from(courseResources)
        .leftJoin(courseResourceBests, eq(courseResourceBests.resourceId, courseResources.id))
        .where(and(...worksWhere))
        .orderBy(desc(courseResources.downloadCount), desc(courseResources.publishedAt), desc(courseResources.createdAt))
        .limit(5);

      return {
        userId: r.userId,
        name: r.name,
        score: Number(r.score ?? 0),
        approveCount: Number(r.approveCount ?? 0),
        bestCount: Number(r.bestCount ?? 0),
        topWorks: topWorksRows.map((w) => buildResourceListItem({ ...w, isBest: !!w.isBest })),
      };
    }),
  );

  return { majorId: params.majorId ?? null, items };
}

export async function listPortalUserWorks(params: {
  userId: string;
  targetUserId: string;
  majorId?: string;
  courseId?: string;
  q?: string;
  best?: boolean;
  sortBy: "downloadCount" | "publishedAt";
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
}) {
  requireUuid(params.targetUserId, "userId");
  if (params.majorId) requireUuid(params.majorId, "majorId");
  if (params.courseId) requireUuid(params.courseId, "courseId");

  const where = [isNull(courseResources.deletedAt), eq(courseResources.status, "published"), eq(courseResources.createdBy, params.targetUserId)];
  if (params.majorId) where.push(eq(courseResources.majorId, params.majorId));
  if (params.courseId) where.push(eq(courseResources.courseId, params.courseId));

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    where.push(or(sql`${courseResources.title} ilike ${pattern}`, sql`${courseResources.description} ilike ${pattern}`)!);
  }

  if (typeof params.best === "boolean") {
    if (params.best) where.push(sql`${courseResourceBests.resourceId} is not null`);
    else where.push(sql`${courseResourceBests.resourceId} is null`);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(courseResources)
    .leftJoin(courseResourceBests, eq(courseResourceBests.resourceId, courseResources.id))
    .where(and(...where));

  const orderBy = [];
  const dir = params.sortOrder === "asc" ? asc : desc;
  if (params.sortBy === "downloadCount") orderBy.push(dir(courseResources.downloadCount));
  else orderBy.push(dir(courseResources.publishedAt));
  orderBy.push(desc(courseResources.createdAt));

  const rows = await db
    .select({
      id: courseResources.id,
      majorId: courseResources.majorId,
      courseId: courseResources.courseId,
      title: courseResources.title,
      description: courseResources.description,
      resourceType: courseResources.resourceType,
      status: courseResources.status,
      downloadCount: courseResources.downloadCount,
      publishedAt: courseResources.publishedAt,
      createdBy: courseResources.createdBy,
      createdAt: courseResources.createdAt,
      isBest: sql<boolean>`(${courseResourceBests.resourceId} is not null)`.as("isBest"),
    })
    .from(courseResources)
    .leftJoin(courseResourceBests, eq(courseResourceBests.resourceId, courseResources.id))
    .where(and(...where))
    .orderBy(...orderBy)
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => buildResourceListItem({ ...r, isBest: !!r.isBest })),
  };
}

export async function listMyResources(params: {
  userId: string;
  page: number;
  pageSize: number;
  status?: ResourceStatus;
  q?: string;
}) {
  const where = [isNull(courseResources.deletedAt), eq(courseResources.createdBy, params.userId)];

  if (params.status) where.push(eq(courseResources.status, params.status));
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    where.push(or(sql`${courseResources.title} ilike ${pattern}`, sql`${courseResources.description} ilike ${pattern}`)!);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(courseResources)
    .where(and(...where));

  const rows = await db
    .select({
      id: courseResources.id,
      majorId: courseResources.majorId,
      courseId: courseResources.courseId,
      title: courseResources.title,
      description: courseResources.description,
      resourceType: courseResources.resourceType,
      status: courseResources.status,
      downloadCount: courseResources.downloadCount,
      publishedAt: courseResources.publishedAt,
      createdBy: courseResources.createdBy,
      createdAt: courseResources.createdAt,
      isBest: sql<boolean>`(${courseResourceBests.resourceId} is not null)`.as("isBest"),
    })
    .from(courseResources)
    .leftJoin(courseResourceBests, eq(courseResourceBests.resourceId, courseResources.id))
    .where(and(...where))
    .orderBy(desc(courseResources.createdAt))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => buildResourceListItem({ ...r, isBest: !!r.isBest })),
  };
}

export async function createMyResourceDraft(params: {
  userId: string;
  majorId: string;
  courseId: string;
  title: string;
  description: string;
  resourceType: ResourceType;
}) {
  requireUuid(params.majorId, "majorId");
  requireUuid(params.courseId, "courseId");

  await ensureMajorExists(params.majorId);
  const course = await ensureCourseExists({ courseId: params.courseId, majorId: params.majorId });

  const inserted = await db
    .insert(courseResources)
    .values({
      majorId: params.majorId,
      courseId: course.id,
      title: params.title,
      description: params.description,
      resourceType: params.resourceType,
      status: "draft",
      createdBy: params.userId,
      updatedBy: params.userId,
    })
    .returning({ id: courseResources.id });

  const id = inserted[0]?.id;
  if (!id) throw badRequest("创建草稿失败");
  return getMyResourceDetail({ userId: params.userId, resourceId: id });
}

export async function getMyResourceDetail(params: { userId: string; resourceId: string }) {
  requireUuid(params.resourceId, "id");

  const rows = await db
    .select({
      id: courseResources.id,
      majorId: courseResources.majorId,
      courseId: courseResources.courseId,
      title: courseResources.title,
      description: courseResources.description,
      resourceType: courseResources.resourceType,
      status: courseResources.status,

      fileBucket: courseResources.fileBucket,
      fileKey: courseResources.fileKey,
      fileName: courseResources.fileName,
      fileSize: courseResources.fileSize,
      sha256: courseResources.sha256,

      linkUrl: courseResources.linkUrl,
      linkUrlNormalized: courseResources.linkUrlNormalized,

      reviewedBy: courseResources.reviewedBy,
      reviewedAt: courseResources.reviewedAt,
      reviewComment: courseResources.reviewComment,
      publishedAt: courseResources.publishedAt,
      unpublishedAt: courseResources.unpublishedAt,

      downloadCount: courseResources.downloadCount,
      isBest: sql<boolean>`(${courseResourceBests.resourceId} is not null)`.as("isBest"),
      createdBy: courseResources.createdBy,
      createdAt: courseResources.createdAt,
    })
    .from(courseResources)
    .leftJoin(courseResourceBests, eq(courseResourceBests.resourceId, courseResources.id))
    .where(and(eq(courseResources.id, params.resourceId), isNull(courseResources.deletedAt), eq(courseResources.createdBy, params.userId)))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound();

  return {
    id: row.id,
    majorId: row.majorId,
    courseId: row.courseId,
    title: row.title,
    description: row.description,
    resourceType: row.resourceType,
    status: row.status,
    file: row.resourceType === "file"
      ? row.fileBucket && row.fileKey && row.fileName && row.fileSize && row.sha256
        ? { bucket: row.fileBucket, key: row.fileKey, fileName: row.fileName, size: row.fileSize, sha256: row.sha256 }
        : null
      : null,
    link: row.resourceType === "link"
      ? row.linkUrl && row.linkUrlNormalized
        ? { url: row.linkUrl, normalizedUrl: row.linkUrlNormalized }
        : null
      : null,
    review: { reviewedBy: row.reviewedBy, reviewedAt: row.reviewedAt, comment: row.reviewComment },
    publishedAt: row.publishedAt,
    unpublishedAt: row.unpublishedAt,
    downloadCount: row.downloadCount,
    isBest: !!row.isBest,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

function assertEditableStatus(status: ResourceStatus) {
  if (status === "draft" || status === "rejected" || status === "unpublished") return;
  throw conflict("仅 draft/rejected/unpublished 状态允许修改");
}

export async function updateMyResource(params: {
  userId: string;
  resourceId: string;
  patch: {
    majorId?: string;
    courseId?: string;
    title?: string;
    description?: string;
    resourceType?: ResourceType;
    linkUrl?: string | null;
  };
}) {
  requireUuid(params.resourceId, "id");

  const current = await getResourceDetailBase(params.resourceId);
  if (current.createdBy !== params.userId) throw notFound();
  assertEditableStatus(current.status);

  const patch: Record<string, unknown> = {};
  if (typeof params.patch.title !== "undefined") patch.title = params.patch.title;
  if (typeof params.patch.description !== "undefined") patch.description = params.patch.description;

  let nextResourceType = (current.resourceType as ResourceType);
  if (typeof params.patch.resourceType !== "undefined") nextResourceType = params.patch.resourceType;

  let nextMajorId = current.majorId;
  let nextCourseId = current.courseId;

  if (typeof params.patch.courseId !== "undefined") {
    requireUuid(params.patch.courseId, "courseId");
    nextCourseId = params.patch.courseId;
  }
  if (typeof params.patch.majorId !== "undefined") {
    requireUuid(params.patch.majorId, "majorId");
    nextMajorId = params.patch.majorId;
  }

  if (nextCourseId !== current.courseId || nextMajorId !== current.majorId) {
    await ensureMajorExists(nextMajorId);
    const course = await ensureCourseExists({ courseId: nextCourseId, majorId: nextMajorId });
    patch.majorId = course.majorId;
    patch.courseId = course.id;
  }

  if (typeof params.patch.resourceType !== "undefined") {
    patch.resourceType = nextResourceType;
    if (nextResourceType === "file") {
      patch.linkUrl = null;
      patch.linkUrlNormalized = null;
    } else {
      patch.fileBucket = null;
      patch.fileKey = null;
      patch.fileName = null;
      patch.fileSize = null;
      patch.sha256 = null;
    }
  }

  if (typeof params.patch.linkUrl !== "undefined") {
    if (nextResourceType !== "link") throw badRequest("仅外链资源允许设置 linkUrl");
    if (params.patch.linkUrl == null) {
      patch.linkUrl = null;
      patch.linkUrlNormalized = null;
    } else {
      const raw = params.patch.linkUrl.trim();
      if (!raw) {
        patch.linkUrl = null;
        patch.linkUrlNormalized = null;
      } else {
        let normalized: string;
        try {
          normalized = normalizeExternalUrl(raw);
        } catch (err) {
          throw badRequest("外链 URL 不合法", { message: err instanceof Error ? err.message : "URL 不合法" });
        }
        patch.linkUrl = raw;
        patch.linkUrlNormalized = normalized;
      }
    }
  }

  patch.updatedBy = params.userId;

  try {
    await db.update(courseResources).set(patch).where(and(eq(courseResources.id, params.resourceId), eq(courseResources.createdBy, params.userId)));
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") throw conflict("资源去重冲突：同一课程下存在相同文件/外链");
    throw err;
  }

  return getMyResourceDetail({ userId: params.userId, resourceId: params.resourceId });
}

export async function deleteMyResource(params: { userId: string; resourceId: string }) {
  requireUuid(params.resourceId, "id");

  const row = await getResourceDetailBase(params.resourceId);
  if (row.createdBy !== params.userId) throw notFound();

  if (!(row.status === "draft" || row.status === "rejected" || row.status === "unpublished")) {
    throw conflict("仅 draft/rejected/unpublished 状态允许删除");
  }

  await db
    .update(courseResources)
    .set({ deletedAt: sql`now()`, updatedBy: params.userId })
    .where(and(eq(courseResources.id, params.resourceId), eq(courseResources.createdBy, params.userId)));

  return { ok: true as const };
}

async function assertReadyForSubmit(row: Awaited<ReturnType<typeof getResourceDetailBase>>) {
  if (row.resourceType === "file") {
    if (!row.fileBucket || !row.fileKey || !row.fileName || !row.fileSize || !row.sha256) {
      throw badRequest("文件资源未完成上传/回填，禁止提交审核");
    }
    const exists = await db
      .select({ id: courseResources.id })
      .from(courseResources)
      .where(
        and(
          isNull(courseResources.deletedAt),
          eq(courseResources.courseId, row.courseId),
          eq(courseResources.resourceType, "file"),
          eq(courseResources.sha256, row.sha256),
          sql`${courseResources.id} <> ${row.id}`,
        ),
      )
      .limit(1);
    if (exists[0]) throw conflict("同一课程下已存在相同文件（sha256）");
    return;
  }

  if (!row.linkUrl || !row.linkUrlNormalized) {
    throw badRequest("外链资源未填写链接，禁止提交审核");
  }
  const exists = await db
    .select({ id: courseResources.id })
    .from(courseResources)
    .where(
      and(
        isNull(courseResources.deletedAt),
        eq(courseResources.courseId, row.courseId),
        eq(courseResources.resourceType, "link"),
        eq(courseResources.linkUrlNormalized, row.linkUrlNormalized),
        sql`${courseResources.id} <> ${row.id}`,
      ),
    )
    .limit(1);
  if (exists[0]) throw conflict("同一课程下已存在相同外链（规范化 URL）");
}

export async function submitMyResource(params: { userId: string; resourceId: string }) {
  requireUuid(params.resourceId, "id");

  const row = await getResourceDetailBase(params.resourceId);
  if (row.createdBy !== params.userId) throw notFound();

  if (!(row.status === "draft" || row.status === "rejected" || row.status === "unpublished")) {
    throw conflict("仅 draft/rejected/unpublished 状态允许提交审核");
  }

  await assertReadyForSubmit(row);

  await db
    .update(courseResources)
    .set({
      status: "pending",
      submittedAt: sql`now()`,
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
      updatedBy: params.userId,
    })
    .where(and(eq(courseResources.id, row.id), eq(courseResources.createdBy, params.userId)));

  return getMyResourceDetail({ userId: params.userId, resourceId: row.id });
}

export async function unpublishMyResource(params: { userId: string; resourceId: string }) {
  requireUuid(params.resourceId, "id");

  const row = await getResourceDetailBase(params.resourceId);
  if (row.createdBy !== params.userId) throw notFound();
  if (row.status !== "published") throw conflict("仅已发布资源允许下架");

  await db
    .update(courseResources)
    .set({ status: "unpublished", unpublishedAt: sql`now()`, updatedBy: params.userId })
    .where(eq(courseResources.id, row.id));

  return getMyResourceDetail({ userId: params.userId, resourceId: row.id });
}

export async function createMyResourceUploadUrl(params: {
  userId: string;
  resourceId: string;
  fileName: string;
  size: number;
  sha256: string;
}) {
  requireUuid(params.resourceId, "id");

  const row = await getResourceDetailBase(params.resourceId);
  if (row.createdBy !== params.userId) throw notFound();
  assertEditableStatus(row.status);
  if (row.resourceType !== "file") throw conflict("仅文件资源允许生成上传链接");

  const sha256 = params.sha256.trim().toLowerCase();
  const exists = await db
    .select({ id: courseResources.id })
    .from(courseResources)
    .where(
      and(
        isNull(courseResources.deletedAt),
        eq(courseResources.courseId, row.courseId),
        eq(courseResources.resourceType, "file"),
        eq(courseResources.sha256, sha256),
        sql`${courseResources.id} <> ${row.id}`,
      ),
    )
    .limit(1);
  if (exists[0]) throw conflict("同一课程下已存在相同文件（sha256）");

  const safeName = sanitizeFileName(params.fileName);

  let key = row.fileKey ?? null;
  const sameAsCurrent =
    row.fileBucket === COURSE_RESOURCES_BUCKET &&
    row.fileKey &&
    row.fileName === params.fileName &&
    row.fileSize === params.size &&
    (row.sha256 ?? "").toLowerCase() === sha256;

  if (!sameAsCurrent) {
    key = `resources/${row.id}/${crypto.randomUUID()}-${safeName}`;
    await db
      .update(courseResources)
      .set({
        fileBucket: COURSE_RESOURCES_BUCKET,
        fileKey: key,
        fileName: params.fileName,
        fileSize: params.size,
        sha256,
        linkUrl: null,
        linkUrlNormalized: null,
        updatedBy: params.userId,
      })
      .where(eq(courseResources.id, row.id));
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(COURSE_RESOURCES_BUCKET).createSignedUploadUrl(key!, { upsert: false });
  if (error || !data?.signedUrl || !data.token) {
    const { status, message } = getStorageErrorMeta(error);
    console.error("[course-resources] createSignedUploadUrl failed", {
      status,
      message,
      bucket: COURSE_RESOURCES_BUCKET,
      key,
    });

    if (status === 404 || /bucket/i.test(message)) {
      throw new HttpError(
        500,
        "INTERNAL_ERROR",
        `生成上传链接失败：请在 Supabase Storage 创建 bucket：${COURSE_RESOURCES_BUCKET}（建议 private）`,
        { status, message },
      );
    }

    if (status === 401 || status === 403) {
      throw new HttpError(
        500,
        "INTERNAL_ERROR",
        "生成上传链接失败：请检查服务端环境变量 SUPABASE_SERVICE_ROLE_KEY 是否为 service_role key，且与 NEXT_PUBLIC_SUPABASE_URL 属于同一 Supabase 项目",
        { status, message },
      );
    }

    throw new HttpError(500, "INTERNAL_ERROR", "生成上传链接失败", { status, message });
  }

  return { bucket: COURSE_RESOURCES_BUCKET, key: key!, token: data.token, uploadUrl: data.signedUrl };
}

async function getMajorAuditSnapshot(majorId: string) {
  const rows = await db
    .select({ id: majors.id, name: majors.name, enabled: majors.enabled, sort: majors.sort, remark: majors.remark, deletedAt: majors.deletedAt })
    .from(majors)
    .where(eq(majors.id, majorId))
    .limit(1);
  return rows[0] ?? null;
}

async function getCourseAuditSnapshot(courseId: string) {
  const rows = await db
    .select({
      id: courses.id,
      majorId: courses.majorId,
      name: courses.name,
      code: courses.code,
      enabled: courses.enabled,
      sort: courses.sort,
      remark: courses.remark,
      deletedAt: courses.deletedAt,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  return rows[0] ?? null;
}

async function getResourceAuditSnapshot(resourceId: string) {
  const row = await getResourceDetailBase(resourceId).catch(() => null);
  if (!row) return null;
  return {
    id: row.id,
    majorId: row.majorId,
    courseId: row.courseId,
    title: row.title,
    status: row.status,
    resourceType: row.resourceType,
    downloadCount: row.downloadCount,
    createdBy: row.createdBy,
    deletedAt: row.deletedAt,
  };
}

export async function listConsoleMajors() {
  const rows = await db
    .select({ id: majors.id, name: majors.name, enabled: majors.enabled, sort: majors.sort, remark: majors.remark })
    .from(majors)
    .where(isNull(majors.deletedAt))
    .orderBy(asc(majors.sort), asc(majors.name));
  return rows;
}

export async function listConsoleScopedMajors(params: { actorUserId: string }) {
  const manageAll = await canManageAllResources(params.actorUserId);
  if (manageAll) return listConsoleMajors();

  const ids = await getScopedMajorIds(params.actorUserId);
  if (ids.length === 0) return [];

  const rows = await db
    .select({ id: majors.id, name: majors.name, enabled: majors.enabled, sort: majors.sort, remark: majors.remark })
    .from(majors)
    .where(and(isNull(majors.deletedAt), inArray(majors.id, ids)))
    .orderBy(asc(majors.sort), asc(majors.name));

  return rows;
}

export async function createConsoleMajor(params: {
  name: string;
  enabled: boolean;
  sort: number;
  remark?: string | null;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  let majorId: string | null = null;
  try {
    const inserted = await db
      .insert(majors)
      .values({ name: params.name, enabled: params.enabled, sort: params.sort, remark: params.remark ?? null })
      .returning({ id: majors.id });

    majorId = inserted[0]?.id ?? null;
    if (!majorId) throw badRequest("创建专业失败");

    const after = await getMajorAuditSnapshot(majorId);
    await writeAuditLog({
      actor: params.actor,
      action: "resource.major.create",
      targetType: "major",
      targetId: majorId,
      success: true,
      reason: params.reason,
      diff: { after },
      request: params.request,
    });

    return { id: majorId };
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      await writeAuditLog({
        actor: params.actor,
        action: "resource.major.create",
        targetType: "major",
        targetId: "new",
        success: false,
        errorCode: "CONFLICT",
        reason: params.reason,
        diff: { name: params.name, enabled: params.enabled, sort: params.sort },
        request: params.request,
      }).catch(() => {});
      throw conflict("专业名称已存在");
    }

    await writeAuditLog({
      actor: params.actor,
      action: "resource.major.create",
      targetType: "major",
      targetId: majorId ?? "new",
      success: false,
      errorCode: toErrorCode(err),
      reason: params.reason,
      diff: { name: params.name, enabled: params.enabled, sort: params.sort },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function updateConsoleMajor(params: {
  majorId: string;
  patch: { name?: string; enabled?: boolean; sort?: number; remark?: string | null };
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  requireUuid(params.majorId, "id");

  const before = await getMajorAuditSnapshot(params.majorId);
  if (!before || before.deletedAt) throw notFound("专业不存在或不可见");

  try {
    await db.update(majors).set(params.patch).where(eq(majors.id, params.majorId));

    const after = await getMajorAuditSnapshot(params.majorId);
    await writeAuditLog({
      actor: params.actor,
      action: "resource.major.update",
      targetType: "major",
      targetId: params.majorId,
      success: true,
      reason: params.reason,
      diff: { before, after },
      request: params.request,
    });

    return { ok: true as const };
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") throw conflict("专业名称已存在");

    await writeAuditLog({
      actor: params.actor,
      action: "resource.major.update",
      targetType: "major",
      targetId: params.majorId,
      success: false,
      errorCode: toErrorCode(err),
      reason: params.reason,
      diff: { before, patch: params.patch },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function deleteConsoleMajor(params: { majorId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  requireUuid(params.majorId, "id");

  const before = await getMajorAuditSnapshot(params.majorId);
  if (!before || before.deletedAt) throw notFound("专业不存在或不可见");

  await db.update(majors).set({ deletedAt: sql`now()`, enabled: false }).where(eq(majors.id, params.majorId));

  const after = await getMajorAuditSnapshot(params.majorId);
  await writeAuditLog({
    actor: params.actor,
    action: "resource.major.delete",
    targetType: "major",
    targetId: params.majorId,
    success: true,
    reason: params.reason,
    diff: { before, after },
    request: params.request,
  });

  return { ok: true as const };
}

export async function listConsoleMajorLeads(params: { majorId: string; actorUserId: string }) {
  requireUuid(params.majorId, "id");
  await ensureMajorExists(params.majorId);

  const rows = await db
    .select({
      userId: majorLeads.userId,
      name: profiles.name,
      username: profiles.username,
      email: authUsers.email,
    })
    .from(majorLeads)
    .leftJoin(profiles, eq(profiles.id, majorLeads.userId))
    .leftJoin(authUsers, eq(authUsers.id, majorLeads.userId))
    .where(eq(majorLeads.majorId, params.majorId))
    .orderBy(asc(profiles.name), asc(majorLeads.userId));

  return rows.map((r) => ({ userId: r.userId, name: r.name ?? null, username: r.username ?? null, email: r.email ?? null }));
}

export async function setConsoleMajorLeads(params: {
  majorId: string;
  userIds: string[];
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  requireUuid(params.majorId, "id");
  await ensureMajorExists(params.majorId);

  const normalized = [...new Set(params.userIds.map((id) => id.trim()))].filter(Boolean);
  for (const id of normalized) requireUuid(id, "userId");

  const before = await listConsoleMajorLeads({ majorId: params.majorId, actorUserId: params.actor.userId });

  await db.transaction(async (tx) => {
    await tx.delete(majorLeads).where(eq(majorLeads.majorId, params.majorId));
    if (normalized.length > 0) {
      await tx.insert(majorLeads).values(normalized.map((userId) => ({ majorId: params.majorId, userId }))).onConflictDoNothing();
    }
  });

  const after = await listConsoleMajorLeads({ majorId: params.majorId, actorUserId: params.actor.userId });

  await writeAuditLog({
    actor: params.actor,
    action: "resource.major_leads.update",
    targetType: "major",
    targetId: params.majorId,
    success: true,
    reason: params.reason,
    diff: { before, after },
    request: params.request,
  });

  return { ok: true as const };
}

export async function listConsoleCourses(params: { actorUserId: string; majorId?: string }) {
  let majorIds: string[] | null = null;
  const manageAll = await canManageAllResources(params.actorUserId);
  if (!manageAll) majorIds = await getScopedMajorIds(params.actorUserId);

  const where = [isNull(courses.deletedAt)];
  if (params.majorId) {
    requireUuid(params.majorId, "majorId");
    if (majorIds && !majorIds.includes(params.majorId)) return [];
    where.push(eq(courses.majorId, params.majorId));
  } else if (majorIds) {
    if (majorIds.length === 0) return [];
    where.push(inArray(courses.majorId, majorIds));
  }

  const rows = await db
    .select({
      id: courses.id,
      majorId: courses.majorId,
      majorName: majors.name,
      name: courses.name,
      code: courses.code,
      enabled: courses.enabled,
      sort: courses.sort,
      remark: courses.remark,
    })
    .from(courses)
    .innerJoin(majors, eq(majors.id, courses.majorId))
    .where(and(...where, isNull(majors.deletedAt)))
    .orderBy(asc(majors.sort), asc(majors.name), asc(courses.sort), asc(courses.name));

  return rows;
}

export async function createConsoleCourse(params: {
  majorId: string;
  name: string;
  code?: string | null;
  enabled: boolean;
  sort: number;
  remark?: string | null;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  requireUuid(params.majorId, "majorId");
  await ensureConsoleMajorScope({ actorUserId: params.actor.userId, majorId: params.majorId });
  await ensureMajorExists(params.majorId);

  let courseId: string | null = null;

  try {
    const inserted = await db
      .insert(courses)
      .values({
        majorId: params.majorId,
        name: params.name,
        code: params.code ?? null,
        enabled: params.enabled,
        sort: params.sort,
        remark: params.remark ?? null,
      })
      .returning({ id: courses.id });

    courseId = inserted[0]?.id ?? null;
    if (!courseId) throw badRequest("创建课程失败");

    const after = await getCourseAuditSnapshot(courseId);
    await writeAuditLog({
      actor: params.actor,
      action: "resource.course.create",
      targetType: "course",
      targetId: courseId,
      success: true,
      reason: params.reason,
      diff: { after },
      request: params.request,
    });

    return { id: courseId };
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") throw conflict("该专业下课程名称已存在");

    await writeAuditLog({
      actor: params.actor,
      action: "resource.course.create",
      targetType: "course",
      targetId: courseId ?? "new",
      success: false,
      errorCode: toErrorCode(err),
      reason: params.reason,
      diff: { majorId: params.majorId, name: params.name },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function updateConsoleCourse(params: {
  courseId: string;
  patch: { majorId?: string; name?: string; code?: string | null; enabled?: boolean; sort?: number; remark?: string | null };
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  requireUuid(params.courseId, "id");

  const before = await getCourseAuditSnapshot(params.courseId);
  if (!before || before.deletedAt) throw notFound("课程不存在或不可见");

  if (typeof params.patch.majorId !== "undefined") {
    requireUuid(params.patch.majorId, "majorId");
    await ensureConsoleMajorScope({ actorUserId: params.actor.userId, majorId: params.patch.majorId });
    await ensureMajorExists(params.patch.majorId);
  } else {
    await ensureConsoleMajorScope({ actorUserId: params.actor.userId, majorId: before.majorId });
  }

  try {
    await db.update(courses).set(params.patch).where(eq(courses.id, params.courseId));
    const after = await getCourseAuditSnapshot(params.courseId);

    await writeAuditLog({
      actor: params.actor,
      action: "resource.course.update",
      targetType: "course",
      targetId: params.courseId,
      success: true,
      reason: params.reason,
      diff: { before, after },
      request: params.request,
    });

    return { ok: true as const };
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") throw conflict("该专业下课程名称已存在");

    await writeAuditLog({
      actor: params.actor,
      action: "resource.course.update",
      targetType: "course",
      targetId: params.courseId,
      success: false,
      errorCode: toErrorCode(err),
      reason: params.reason,
      diff: { before, patch: params.patch },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function deleteConsoleCourse(params: { courseId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  requireUuid(params.courseId, "id");

  const before = await getCourseAuditSnapshot(params.courseId);
  if (!before || before.deletedAt) throw notFound("课程不存在或不可见");

  await ensureConsoleMajorScope({ actorUserId: params.actor.userId, majorId: before.majorId });

  await db.update(courses).set({ deletedAt: sql`now()`, enabled: false }).where(eq(courses.id, params.courseId));
  const after = await getCourseAuditSnapshot(params.courseId);

  await writeAuditLog({
    actor: params.actor,
    action: "resource.course.delete",
    targetType: "course",
    targetId: params.courseId,
    success: true,
    reason: params.reason,
    diff: { before, after },
    request: params.request,
  });

  return { ok: true as const };
}

export async function listConsoleResources(params: {
  actorUserId: string;
  page: number;
  pageSize: number;
  status?: ResourceStatus;
  majorId?: string;
  courseId?: string;
  q?: string;
}) {
  const manageAll = await canManageAllResources(params.actorUserId);
  const allowedMajors = manageAll ? [] : await getScopedMajorIds(params.actorUserId);
  if (!manageAll && allowedMajors.length === 0) return { page: params.page, pageSize: params.pageSize, total: 0, items: [] };

  const where = [isNull(courseResources.deletedAt)];
  if (!manageAll) where.push(inArray(courseResources.majorId, allowedMajors));

  if (params.status) where.push(eq(courseResources.status, params.status));
  if (params.majorId) {
    requireUuid(params.majorId, "majorId");
    if (!manageAll && !allowedMajors.includes(params.majorId)) return { page: params.page, pageSize: params.pageSize, total: 0, items: [] };
    where.push(eq(courseResources.majorId, params.majorId));
  }
  if (params.courseId) {
    requireUuid(params.courseId, "courseId");
    where.push(eq(courseResources.courseId, params.courseId));
  }
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    where.push(or(sql`${courseResources.title} ilike ${pattern}`, sql`${courseResources.description} ilike ${pattern}`)!);
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(courseResources)
    .where(and(...where));

  const rows = await db
    .select({
      id: courseResources.id,
      majorId: courseResources.majorId,
      majorName: majors.name,
      courseId: courseResources.courseId,
      courseName: courses.name,
      title: courseResources.title,
      status: courseResources.status,
      resourceType: courseResources.resourceType,
      downloadCount: courseResources.downloadCount,
      submittedAt: courseResources.submittedAt,
      reviewedAt: courseResources.reviewedAt,
      publishedAt: courseResources.publishedAt,
      createdBy: courseResources.createdBy,
      authorName: profiles.name,
      createdAt: courseResources.createdAt,
      isBest: sql<boolean>`(${courseResourceBests.resourceId} is not null)`.as("isBest"),
    })
    .from(courseResources)
    .innerJoin(majors, eq(majors.id, courseResources.majorId))
    .innerJoin(courses, eq(courses.id, courseResources.courseId))
    .leftJoin(profiles, eq(profiles.id, courseResources.createdBy))
    .leftJoin(courseResourceBests, eq(courseResourceBests.resourceId, courseResources.id))
    .where(and(...where, isNull(majors.deletedAt), isNull(courses.deletedAt)))
    .orderBy(desc(courseResources.createdAt))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      ...buildResourceListItem({ ...r, description: "", isBest: !!r.isBest }),
      majorName: r.majorName,
      courseName: r.courseName,
      submittedAt: r.submittedAt,
      reviewedAt: r.reviewedAt,
      authorName: r.authorName ?? null,
    })),
  };
}

export async function getConsoleResourceDetail(params: { actorUserId: string; resourceId: string }) {
  requireUuid(params.resourceId, "id");
  await ensureConsoleResourceScope({ actorUserId: params.actorUserId, resourceId: params.resourceId });

  const rows = await db
    .select({
      id: courseResources.id,
      majorId: courseResources.majorId,
      majorName: majors.name,
      courseId: courseResources.courseId,
      courseName: courses.name,
      title: courseResources.title,
      description: courseResources.description,
      resourceType: courseResources.resourceType,
      status: courseResources.status,

      fileBucket: courseResources.fileBucket,
      fileKey: courseResources.fileKey,
      fileName: courseResources.fileName,
      fileSize: courseResources.fileSize,
      sha256: courseResources.sha256,

      linkUrl: courseResources.linkUrl,
      linkUrlNormalized: courseResources.linkUrlNormalized,

      submittedAt: courseResources.submittedAt,
      reviewedBy: courseResources.reviewedBy,
      reviewedAt: courseResources.reviewedAt,
      reviewComment: courseResources.reviewComment,
      publishedAt: courseResources.publishedAt,
      unpublishedAt: courseResources.unpublishedAt,
      downloadCount: courseResources.downloadCount,
      lastDownloadAt: courseResources.lastDownloadAt,

      createdBy: courseResources.createdBy,
      authorName: profiles.name,
      authorEmail: authUsers.email,
      createdAt: courseResources.createdAt,
      updatedBy: courseResources.updatedBy,
      updatedAt: courseResources.updatedAt,

      isBest: sql<boolean>`(${courseResourceBests.resourceId} is not null)`.as("isBest"),
    })
    .from(courseResources)
    .innerJoin(majors, eq(majors.id, courseResources.majorId))
    .innerJoin(courses, eq(courses.id, courseResources.courseId))
    .leftJoin(profiles, eq(profiles.id, courseResources.createdBy))
    .leftJoin(authUsers, eq(authUsers.id, courseResources.createdBy))
    .leftJoin(courseResourceBests, eq(courseResourceBests.resourceId, courseResources.id))
    .where(and(eq(courseResources.id, params.resourceId), isNull(courseResources.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound();

  return {
    id: row.id,
    majorId: row.majorId,
    majorName: row.majorName,
    courseId: row.courseId,
    courseName: row.courseName,
    title: row.title,
    description: row.description,
    resourceType: row.resourceType,
    status: row.status,
    file: row.resourceType === "file" && row.fileBucket && row.fileKey && row.fileName && row.fileSize && row.sha256
      ? { bucket: row.fileBucket, key: row.fileKey, fileName: row.fileName, size: row.fileSize, sha256: row.sha256 }
      : null,
    link: row.resourceType === "link" && row.linkUrl && row.linkUrlNormalized ? { url: row.linkUrl, normalizedUrl: row.linkUrlNormalized } : null,
    submittedAt: row.submittedAt,
    review: { reviewedBy: row.reviewedBy, reviewedAt: row.reviewedAt, comment: row.reviewComment },
    publishedAt: row.publishedAt,
    unpublishedAt: row.unpublishedAt,
    downloadCount: row.downloadCount,
    lastDownloadAt: row.lastDownloadAt,
    isBest: !!row.isBest,
    createdBy: row.createdBy,
    authorName: row.authorName ?? null,
    authorEmail: row.authorEmail ?? null,
    createdAt: row.createdAt,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

export async function approveConsoleResource(params: {
  resourceId: string;
  comment?: string;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  requireUuid(params.resourceId, "id");

  await ensureConsoleResourceScope({ actorUserId: params.actor.userId, resourceId: params.resourceId });
  const before = await getResourceAuditSnapshot(params.resourceId);
  if (!before) throw notFound();
  if (before.status !== "pending") throw conflict("仅待审核资源允许通过");

  const approveDelta = await getConfigNumber("courseResources.score.approveDelta", DEFAULT_APPROVE_DELTA);

  try {
    const detail = await getResourceDetailBase(params.resourceId);

    if (detail.resourceType === "file") {
      if (!detail.fileBucket || !detail.fileKey || !detail.fileName) {
        throw conflict("文件信息不完整，无法审核通过");
      }

      const fileKey = detail.fileKey;
      const parts = fileKey.split("/");
      const dir = parts.slice(0, -1).join("/");
      const name = parts[parts.length - 1] ?? "";

      const supabase = createSupabaseAdminClient();
      let listData: { name: string }[] | null = null;
      let listError: unknown = null;
      try {
        const res = await supabase.storage.from(detail.fileBucket).list(dir, { limit: 100, search: name });
        listData = res.data;
        listError = res.error;
      } catch (err) {
        listError = err;
      }

      if (listError) {
        const { status, message } = getStorageErrorMeta(listError);
        console.error("[course-resources] approve check storage list failed", {
          status,
          message,
          bucket: detail.fileBucket,
          dir,
          resourceId: detail.id,
        });
        throw new HttpError(500, "INTERNAL_ERROR", "校验文件存在性失败", { status, message });
      }

      const exists = (listData ?? []).some((o) => o.name === name);
      if (!exists) {
        throw conflict("文件尚未成功上传或已被移除，禁止审核通过；请先要求作者重新上传并再次提交审核");
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(courseResources)
        .set({
          status: "published",
          reviewedBy: params.actor.userId,
          reviewedAt: sql`now()`,
          reviewComment: params.comment ?? null,
          publishedAt: sql`now()`,
          unpublishedAt: null,
          updatedBy: params.actor.userId,
        })
        .where(eq(courseResources.id, params.resourceId));

      await tx
        .insert(courseResourceScoreEvents)
        .values({
          userId: detail.createdBy,
          majorId: detail.majorId,
          resourceId: detail.id,
          eventType: "approve",
          delta: Math.max(1, Math.trunc(approveDelta)),
        })
        .onConflictDoNothing();
    });

    const after = await getResourceAuditSnapshot(params.resourceId);

    await writeAuditLog({
      actor: params.actor,
      action: "resource.review.approve",
      targetType: "course_resource",
      targetId: params.resourceId,
      success: true,
      reason: params.reason,
      diff: { before, after, comment: params.comment ?? null, approveDelta },
      request: params.request,
    });

    return getConsoleResourceDetail({ actorUserId: params.actor.userId, resourceId: params.resourceId });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "resource.review.approve",
      targetType: "course_resource",
      targetId: params.resourceId,
      success: false,
      errorCode: toErrorCode(err),
      reason: params.reason,
      diff: { before, comment: params.comment ?? null },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function rejectConsoleResource(params: {
  resourceId: string;
  comment: string;
  actor: AuditActor;
  request: RequestContext;
  reason?: string;
}) {
  requireUuid(params.resourceId, "id");

  await ensureConsoleResourceScope({ actorUserId: params.actor.userId, resourceId: params.resourceId });
  const before = await getResourceAuditSnapshot(params.resourceId);
  if (!before) throw notFound();
  if (before.status !== "pending") throw conflict("仅待审核资源允许驳回");

  try {
    await db
      .update(courseResources)
      .set({
        status: "rejected",
        reviewedBy: params.actor.userId,
        reviewedAt: sql`now()`,
        reviewComment: params.comment,
        updatedBy: params.actor.userId,
      })
      .where(eq(courseResources.id, params.resourceId));

    const after = await getResourceAuditSnapshot(params.resourceId);

    await writeAuditLog({
      actor: params.actor,
      action: "resource.review.reject",
      targetType: "course_resource",
      targetId: params.resourceId,
      success: true,
      reason: params.reason,
      diff: { before, after, comment: params.comment },
      request: params.request,
    });

    return getConsoleResourceDetail({ actorUserId: params.actor.userId, resourceId: params.resourceId });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "resource.review.reject",
      targetType: "course_resource",
      targetId: params.resourceId,
      success: false,
      errorCode: toErrorCode(err),
      reason: params.reason,
      diff: { before, comment: params.comment },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function offlineConsoleResource(params: { resourceId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  requireUuid(params.resourceId, "id");

  await ensureConsoleResourceScope({ actorUserId: params.actor.userId, resourceId: params.resourceId });
  const before = await getResourceAuditSnapshot(params.resourceId);
  if (!before) throw notFound();
  if (before.status !== "published") throw conflict("仅已发布资源允许下架");

  await db
    .update(courseResources)
    .set({ status: "unpublished", unpublishedAt: sql`now()`, updatedBy: params.actor.userId })
    .where(eq(courseResources.id, params.resourceId));
  const after = await getResourceAuditSnapshot(params.resourceId);

  await writeAuditLog({
    actor: params.actor,
    action: "resource.offline",
    targetType: "course_resource",
    targetId: params.resourceId,
    success: true,
    reason: params.reason,
    diff: { before, after },
    request: params.request,
  });

  return getConsoleResourceDetail({ actorUserId: params.actor.userId, resourceId: params.resourceId });
}

export async function bestConsoleResource(params: { resourceId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  requireUuid(params.resourceId, "id");

  await ensureConsoleResourceScope({ actorUserId: params.actor.userId, resourceId: params.resourceId });
  const before = await getResourceAuditSnapshot(params.resourceId);
  if (!before) throw notFound();
  if (before.status !== "published") throw conflict("仅已发布资源允许设为最佳");

  const bestDelta = await getConfigNumber("courseResources.score.bestDelta", DEFAULT_BEST_DELTA);
  const detail = await getResourceDetailBase(params.resourceId);

  await db.transaction(async (tx) => {
    await tx
      .insert(courseResourceBests)
      .values({ resourceId: params.resourceId, bestBy: params.actor.userId })
      .onConflictDoUpdate({
        target: courseResourceBests.resourceId,
        set: { bestBy: params.actor.userId, bestAt: sql`now()` },
      });

    await tx
      .insert(courseResourceScoreEvents)
      .values({
        userId: detail.createdBy,
        majorId: detail.majorId,
        resourceId: detail.id,
        eventType: "best",
        delta: Math.max(1, Math.trunc(bestDelta)),
      })
      .onConflictDoNothing();
  });

  const after = await getResourceAuditSnapshot(params.resourceId);
  await writeAuditLog({
    actor: params.actor,
    action: "resource.best.set",
    targetType: "course_resource",
    targetId: params.resourceId,
    success: true,
    reason: params.reason,
    diff: { before, after, bestDelta },
    request: params.request,
  });

  return getConsoleResourceDetail({ actorUserId: params.actor.userId, resourceId: params.resourceId });
}

export async function unbestConsoleResource(params: { resourceId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  requireUuid(params.resourceId, "id");

  await ensureConsoleResourceScope({ actorUserId: params.actor.userId, resourceId: params.resourceId });
  const before = await getResourceAuditSnapshot(params.resourceId);
  if (!before) throw notFound();

  await db.delete(courseResourceBests).where(eq(courseResourceBests.resourceId, params.resourceId));

  const after = await getResourceAuditSnapshot(params.resourceId);
  await writeAuditLog({
    actor: params.actor,
    action: "resource.best.unset",
    targetType: "course_resource",
    targetId: params.resourceId,
    success: true,
    reason: params.reason,
    diff: { before, after },
    request: params.request,
  });

  return getConsoleResourceDetail({ actorUserId: params.actor.userId, resourceId: params.resourceId });
}

export async function hardDeleteConsoleResource(params: { resourceId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  requireUuid(params.resourceId, "id");

  const before = await getResourceAuditSnapshot(params.resourceId);
  if (!before) throw notFound();

  await db.delete(courseResources).where(eq(courseResources.id, params.resourceId));

  await writeAuditLog({
    actor: params.actor,
    action: "resource.delete.hard",
    targetType: "course_resource",
    targetId: params.resourceId,
    success: true,
    reason: params.reason,
    diff: { before },
    request: params.request,
  });

  return { ok: true as const };
}
