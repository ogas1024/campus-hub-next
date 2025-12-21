import "server-only";

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { badRequest, conflict, HttpError, notFound } from "@/lib/http/errors";
import type { RequestContext } from "@/lib/http/route";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import { writeAuditLog } from "@/lib/modules/audit/audit.service";
import { storageAdapter } from "@/lib/storage";
import {
  LOSTFOUND_ALLOWED_IMAGE_MIME_TYPES,
  LOSTFOUND_IMAGE_BUCKET,
  LOSTFOUND_MAX_IMAGE_BYTES,
  LOSTFOUND_MAX_IMAGES,
  LOSTFOUND_SIGNED_URL_EXPIRES_IN_SECONDS,
} from "@/lib/modules/lostfound/lostfound.ui";
import { assertOwnedImageKeys, parseIsoDateTimeOrNull, requireUuid } from "@/lib/modules/lostfound/lostfound.utils";
import { authUsers, lostfoundItemImages, lostfoundItems, profiles } from "@campus-hub/db";

type LostfoundStatus = "pending" | "published" | "rejected" | "offline";
type LostfoundType = "lost" | "found";

function toErrorCode(err: unknown) {
  return err instanceof HttpError ? err.code : "INTERNAL_ERROR";
}

function assertValidImageFile(file: Blob) {
  if (file.size <= 0) throw badRequest("图片文件为空");
  if (file.size > LOSTFOUND_MAX_IMAGE_BYTES) throw badRequest("图片过大（单张最大 2MB）");

  const contentType = (file as { type?: string } | null)?.type ?? "";
  if (!LOSTFOUND_ALLOWED_IMAGE_MIME_TYPES.includes(contentType as (typeof LOSTFOUND_ALLOWED_IMAGE_MIME_TYPES)[number])) {
    throw badRequest("图片仅支持 JPG/PNG/WEBP");
  }

  const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  return { contentType, ext };
}

async function toSignedImage(params: { bucket: string; key: string }) {
  const res = await storageAdapter.createSignedDownloadUrl({
    bucket: params.bucket,
    key: params.key,
    expiresIn: LOSTFOUND_SIGNED_URL_EXPIRES_IN_SECONDS,
  });
  return { bucket: res.bucket, key: res.key, signedUrl: res.signedUrl };
}

async function listImagesForItems(itemIds: string[]) {
  const ids = [...new Set(itemIds)].filter(Boolean);
  if (ids.length === 0) return new Map<string, Array<{ bucket: string; key: string }>>();

  const rows = await db
    .select({
      itemId: lostfoundItemImages.itemId,
      bucket: lostfoundItemImages.bucket,
      key: lostfoundItemImages.key,
      sortNo: lostfoundItemImages.sortNo,
      id: lostfoundItemImages.id,
    })
    .from(lostfoundItemImages)
    .where(inArray(lostfoundItemImages.itemId, ids))
    .orderBy(asc(lostfoundItemImages.sortNo), asc(lostfoundItemImages.id));

  const map = new Map<string, Array<{ bucket: string; key: string }>>();
  for (const r of rows) {
    const list = map.get(r.itemId) ?? [];
    list.push({ bucket: r.bucket, key: r.key });
    map.set(r.itemId, list);
  }
  return map;
}

function buildKeywordCondition(q: string): SQL {
  const pattern = `%${q}%`;
  return (
    or(
      sql`${lostfoundItems.title} ilike ${pattern}`,
      sql`${lostfoundItems.content} ilike ${pattern}`,
      sql`${lostfoundItems.location} ilike ${pattern}`,
    ) ?? sql`${lostfoundItems.title} ilike ${pattern}`
  );
}

export async function uploadMyLostfoundImage(params: { userId: string; file: Blob }) {
  const meta = assertValidImageFile(params.file);
  const key = `users/${params.userId}/lostfound/${crypto.randomUUID()}.${meta.ext}`;

  await storageAdapter.uploadPrivate({
    bucket: LOSTFOUND_IMAGE_BUCKET,
    key,
    file: params.file,
    contentType: meta.contentType,
    upsert: false,
    cacheControl: "3600",
  });

  return toSignedImage({ bucket: LOSTFOUND_IMAGE_BUCKET, key });
}

export async function listPortalLostfound(params: {
  page: number;
  pageSize: number;
  type?: LostfoundType;
  q?: string;
  includeSolved: boolean;
  from?: Date;
  to?: Date;
}) {
  const where: SQL[] = [eq(lostfoundItems.status, "published"), isNull(lostfoundItems.deletedAt)];

  if (params.type) where.push(eq(lostfoundItems.type, params.type));
  if (!params.includeSolved) where.push(isNull(lostfoundItems.solvedAt));
  if (params.q && params.q.trim()) where.push(buildKeywordCondition(params.q.trim()));
  if (params.from) where.push(sql`${lostfoundItems.publishAt} >= ${params.from.toISOString()}`);
  if (params.to) where.push(sql`${lostfoundItems.publishAt} <= ${params.to.toISOString()}`);

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(lostfoundItems)
    .where(where.length > 0 ? and(...where) : undefined);

  const rows = await db
    .select({
      id: lostfoundItems.id,
      type: lostfoundItems.type,
      title: lostfoundItems.title,
      location: lostfoundItems.location,
      occurredAt: lostfoundItems.occurredAt,
      publishAt: lostfoundItems.publishAt,
      solvedAt: lostfoundItems.solvedAt,
    })
    .from(lostfoundItems)
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(lostfoundItems.publishAt), desc(lostfoundItems.id))
    .limit(params.pageSize)
    .offset(offset);

  const itemIds = rows.map((r) => r.id);
  const imagesByItemId = await listImagesForItems(itemIds);

  const coverByItemId = new Map<string, { bucket: string; key: string }>();
  for (const [itemId, images] of imagesByItemId.entries()) {
    const first = images[0];
    if (first) coverByItemId.set(itemId, first);
  }

  const coverSignedByItemId = new Map<string, { bucket: string; key: string; signedUrl: string }>();
  await Promise.all(
    [...coverByItemId.entries()].map(async ([itemId, img]) => {
      coverSignedByItemId.set(itemId, await toSignedImage(img));
    }),
  );

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      type: r.type as LostfoundType,
      title: r.title,
      location: r.location ?? null,
      occurredAt: r.occurredAt,
      publishedAt: r.publishAt,
      solvedAt: r.solvedAt,
      coverImage: coverSignedByItemId.get(r.id) ?? null,
    })),
  };
}

export async function getPortalLostfoundDetail(params: { itemId: string }) {
  requireUuid(params.itemId, "id");

  const rows = await db
    .select({
      id: lostfoundItems.id,
      type: lostfoundItems.type,
      title: lostfoundItems.title,
      content: lostfoundItems.content,
      location: lostfoundItems.location,
      occurredAt: lostfoundItems.occurredAt,
      contactInfo: lostfoundItems.contactInfo,
      status: lostfoundItems.status,
      publishAt: lostfoundItems.publishAt,
      solvedAt: lostfoundItems.solvedAt,
      createdAt: lostfoundItems.createdAt,
      updatedAt: lostfoundItems.updatedAt,
    })
    .from(lostfoundItems)
    .where(and(eq(lostfoundItems.id, params.itemId), eq(lostfoundItems.status, "published"), isNull(lostfoundItems.deletedAt)))
    .limit(1);

  const item = rows[0];
  if (!item) throw notFound();

  const images = await db
    .select({ bucket: lostfoundItemImages.bucket, key: lostfoundItemImages.key, sortNo: lostfoundItemImages.sortNo })
    .from(lostfoundItemImages)
    .where(eq(lostfoundItemImages.itemId, item.id))
    .orderBy(asc(lostfoundItemImages.sortNo), asc(lostfoundItemImages.id));

  const signedImages = await Promise.all(images.map((img) => toSignedImage({ bucket: img.bucket, key: img.key })));

  return {
    id: item.id,
    type: item.type as LostfoundType,
    title: item.title,
    content: item.content,
    location: item.location ?? null,
    occurredAt: item.occurredAt,
    contactInfo: item.contactInfo ?? null,
    status: item.status as LostfoundStatus,
    publishedAt: item.publishAt,
    solvedAt: item.solvedAt,
    images: signedImages,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function listMyLostfoundItems(params: { userId: string; page: number; pageSize: number; status?: LostfoundStatus; q?: string }) {
  const where: SQL[] = [eq(lostfoundItems.createdBy, params.userId), isNull(lostfoundItems.deletedAt)];
  if (params.status) where.push(eq(lostfoundItems.status, params.status));
  if (params.q && params.q.trim()) where.push(buildKeywordCondition(params.q.trim()));

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(lostfoundItems)
    .where(where.length > 0 ? and(...where) : undefined);

  const rows = await db
    .select({
      id: lostfoundItems.id,
      type: lostfoundItems.type,
      title: lostfoundItems.title,
      status: lostfoundItems.status,
      publishAt: lostfoundItems.publishAt,
      solvedAt: lostfoundItems.solvedAt,
      rejectReason: lostfoundItems.rejectReason,
      offlineReason: lostfoundItems.offlineReason,
      createdAt: lostfoundItems.createdAt,
    })
    .from(lostfoundItems)
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(lostfoundItems.createdAt), desc(lostfoundItems.id))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      type: r.type as LostfoundType,
      title: r.title,
      status: r.status as LostfoundStatus,
      publishedAt: r.publishAt,
      solvedAt: r.solvedAt,
      rejectReason: r.rejectReason ?? null,
      offlineReason: r.offlineReason ?? null,
      createdAt: r.createdAt,
    })),
  };
}

export async function getMyLostfoundDetail(params: { userId: string; itemId: string }) {
  requireUuid(params.itemId, "id");

  const rows = await db
    .select({
      id: lostfoundItems.id,
      type: lostfoundItems.type,
      title: lostfoundItems.title,
      content: lostfoundItems.content,
      location: lostfoundItems.location,
      occurredAt: lostfoundItems.occurredAt,
      contactInfo: lostfoundItems.contactInfo,
      status: lostfoundItems.status,
      publishAt: lostfoundItems.publishAt,
      solvedAt: lostfoundItems.solvedAt,
      rejectReason: lostfoundItems.rejectReason,
      offlineReason: lostfoundItems.offlineReason,
      createdAt: lostfoundItems.createdAt,
      updatedAt: lostfoundItems.updatedAt,
    })
    .from(lostfoundItems)
    .where(and(eq(lostfoundItems.id, params.itemId), eq(lostfoundItems.createdBy, params.userId), isNull(lostfoundItems.deletedAt)))
    .limit(1);

  const item = rows[0];
  if (!item) throw notFound();

  const images = await db
    .select({ bucket: lostfoundItemImages.bucket, key: lostfoundItemImages.key, sortNo: lostfoundItemImages.sortNo })
    .from(lostfoundItemImages)
    .where(eq(lostfoundItemImages.itemId, item.id))
    .orderBy(asc(lostfoundItemImages.sortNo), asc(lostfoundItemImages.id));

  const signedImages = await Promise.all(images.map((img) => toSignedImage({ bucket: img.bucket, key: img.key })));

  return {
    id: item.id,
    type: item.type as LostfoundType,
    title: item.title,
    content: item.content,
    location: item.location ?? null,
    occurredAt: item.occurredAt,
    contactInfo: item.contactInfo ?? null,
    status: item.status as LostfoundStatus,
    publishedAt: item.publishAt,
    solvedAt: item.solvedAt,
    rejectReason: item.rejectReason ?? null,
    offlineReason: item.offlineReason ?? null,
    images: signedImages,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function createMyLostfoundItem(params: {
  userId: string;
  body: {
    type: LostfoundType;
    title: string;
    content: string;
    location: string | null;
    occurredAt: string | null;
    contactInfo: string | null;
    imageKeys: string[];
  };
}) {
  const imageKeys = assertOwnedImageKeys({ userId: params.userId, keys: params.body.imageKeys, max: LOSTFOUND_MAX_IMAGES });
  const occurredAt = parseIsoDateTimeOrNull(params.body.occurredAt, "occurredAt");

  return db.transaction(async (tx) => {
    const created = await tx
      .insert(lostfoundItems)
      .values({
        type: params.body.type,
        title: params.body.title,
        content: params.body.content,
        location: params.body.location ?? null,
        occurredAt,
        contactInfo: params.body.contactInfo ?? null,
        status: "pending",
        publishAt: null,
        rejectReason: null,
        offlineReason: null,
        reviewedBy: null,
        reviewedAt: null,
        offlinedBy: null,
        offlinedAt: null,
        solvedAt: null,
        createdBy: params.userId,
        updatedBy: null,
      })
      .returning({ id: lostfoundItems.id });

    const itemId = created[0]!.id;

    if (imageKeys.length > 0) {
      await tx.insert(lostfoundItemImages).values(
        imageKeys.map((key, idx) => ({
          itemId,
          bucket: LOSTFOUND_IMAGE_BUCKET,
          key,
          sortNo: idx,
        })),
      );
    }

    return { id: itemId };
  });
}

export async function updateMyLostfoundItem(params: {
  userId: string;
  itemId: string;
  body: {
    type?: LostfoundType;
    title?: string;
    content?: string;
    location?: string | null;
    occurredAt?: string | null;
    contactInfo?: string | null;
    imageKeys?: string[];
  };
}) {
  requireUuid(params.itemId, "id");

  const rows = await db
    .select({
      type: lostfoundItems.type,
      title: lostfoundItems.title,
      content: lostfoundItems.content,
      location: lostfoundItems.location,
      occurredAt: lostfoundItems.occurredAt,
      contactInfo: lostfoundItems.contactInfo,
      status: lostfoundItems.status,
      solvedAt: lostfoundItems.solvedAt,
    })
    .from(lostfoundItems)
    .where(and(eq(lostfoundItems.id, params.itemId), eq(lostfoundItems.createdBy, params.userId), isNull(lostfoundItems.deletedAt)))
    .limit(1);

  const item = rows[0];
  if (!item) throw notFound();
  if (item.solvedAt) throw conflict("已解决条目不可编辑");
  if ((item.status as LostfoundStatus) === "offline") throw conflict("已下架条目不可编辑，请联系管理端恢复为待审后再修改");

  const occurredAt = params.body.occurredAt === undefined ? undefined : parseIsoDateTimeOrNull(params.body.occurredAt, "occurredAt");

  const imageKeys =
    params.body.imageKeys === undefined
      ? undefined
      : assertOwnedImageKeys({ userId: params.userId, keys: params.body.imageKeys, max: LOSTFOUND_MAX_IMAGES });

  await db.transaction(async (tx) => {
    const next = {
      type: params.body.type ?? (item.type as LostfoundType),
      title: params.body.title ?? item.title,
      content: params.body.content ?? item.content,
      location: params.body.location !== undefined ? params.body.location : item.location ?? null,
      occurredAt: occurredAt !== undefined ? occurredAt : item.occurredAt,
      contactInfo: params.body.contactInfo !== undefined ? params.body.contactInfo : item.contactInfo ?? null,
    };

    const set = {
      type: next.type,
      title: next.title,
      content: next.content,
      location: next.location,
      occurredAt: next.occurredAt,
      contactInfo: next.contactInfo,
      status: "pending" as const,
      publishAt: null,
      rejectReason: null,
      offlineReason: null,
      reviewedBy: null,
      reviewedAt: null,
      offlinedBy: null,
      offlinedAt: null,
      updatedBy: params.userId,
    };

    await tx.update(lostfoundItems).set(set).where(eq(lostfoundItems.id, params.itemId));

    if (imageKeys !== undefined) {
      await tx.delete(lostfoundItemImages).where(eq(lostfoundItemImages.itemId, params.itemId));
      if (imageKeys.length > 0) {
        await tx.insert(lostfoundItemImages).values(
          imageKeys.map((key, idx) => ({
            itemId: params.itemId,
            bucket: LOSTFOUND_IMAGE_BUCKET,
            key,
            sortNo: idx,
          })),
        );
      }
    }
  });

  return { ok: true as const };
}

export async function deleteMyLostfoundItem(params: { userId: string; itemId: string }) {
  requireUuid(params.itemId, "id");

  const updated = await db
    .update(lostfoundItems)
    .set({ deletedAt: sql`now()`, updatedBy: params.userId })
    .where(and(eq(lostfoundItems.id, params.itemId), eq(lostfoundItems.createdBy, params.userId), isNull(lostfoundItems.deletedAt)))
    .returning({ id: lostfoundItems.id });

  if (updated.length === 0) throw notFound();
  return { ok: true as const };
}

export async function solveMyLostfoundItem(params: { userId: string; itemId: string }) {
  requireUuid(params.itemId, "id");

  const rows = await db
    .select({ status: lostfoundItems.status, solvedAt: lostfoundItems.solvedAt })
    .from(lostfoundItems)
    .where(and(eq(lostfoundItems.id, params.itemId), eq(lostfoundItems.createdBy, params.userId), isNull(lostfoundItems.deletedAt)))
    .limit(1);

  const item = rows[0];
  if (!item) throw notFound();
  if ((item.status as LostfoundStatus) !== "published") throw conflict("仅已发布条目可标记为已解决");
  if (item.solvedAt) throw conflict("条目已标记为已解决");

  await db
    .update(lostfoundItems)
    .set({ solvedAt: sql`now()`, updatedBy: params.userId })
    .where(eq(lostfoundItems.id, params.itemId));

  return { ok: true as const };
}

async function getLostfoundAuditSnapshot(itemId: string) {
  const rows = await db
    .select({
      id: lostfoundItems.id,
      status: lostfoundItems.status,
      publishAt: lostfoundItems.publishAt,
      rejectReason: lostfoundItems.rejectReason,
      offlineReason: lostfoundItems.offlineReason,
      solvedAt: lostfoundItems.solvedAt,
    })
    .from(lostfoundItems)
    .where(and(eq(lostfoundItems.id, itemId), isNull(lostfoundItems.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status as LostfoundStatus,
    publishedAt: row.publishAt,
    rejectReason: row.rejectReason ?? null,
    offlineReason: row.offlineReason ?? null,
    solvedAt: row.solvedAt,
  };
}

export async function listConsoleLostfound(params: {
  page: number;
  pageSize: number;
  status?: LostfoundStatus;
  type?: LostfoundType;
  q?: string;
  from?: Date;
  to?: Date;
}) {
  const where: SQL[] = [isNull(lostfoundItems.deletedAt)];
  if (params.status) where.push(eq(lostfoundItems.status, params.status));
  if (params.type) where.push(eq(lostfoundItems.type, params.type));
  if (params.q && params.q.trim()) where.push(buildKeywordCondition(params.q.trim()));
  if (params.from) where.push(sql`${lostfoundItems.createdAt} >= ${params.from.toISOString()}`);
  if (params.to) where.push(sql`${lostfoundItems.createdAt} <= ${params.to.toISOString()}`);

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(lostfoundItems)
    .where(where.length > 0 ? and(...where) : undefined);

  const rows = await db
    .select({
      id: lostfoundItems.id,
      type: lostfoundItems.type,
      title: lostfoundItems.title,
      status: lostfoundItems.status,
      publishAt: lostfoundItems.publishAt,
      solvedAt: lostfoundItems.solvedAt,
      createdBy: lostfoundItems.createdBy,
      authorName: profiles.name,
      authorStudentId: profiles.studentId,
      createdAt: lostfoundItems.createdAt,
    })
    .from(lostfoundItems)
    .leftJoin(profiles, eq(profiles.id, lostfoundItems.createdBy))
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(lostfoundItems.createdAt), desc(lostfoundItems.id))
    .limit(params.pageSize)
    .offset(offset);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      type: r.type as LostfoundType,
      title: r.title,
      status: r.status as LostfoundStatus,
      publishedAt: r.publishAt,
      solvedAt: r.solvedAt,
      createdBy: { id: r.createdBy, name: r.authorName ?? "—", studentId: r.authorStudentId ?? "—" },
      createdAt: r.createdAt,
    })),
  };
}

export async function getConsoleLostfoundDetail(params: { itemId: string }) {
  requireUuid(params.itemId, "id");

  const rows = await db
    .select({
      id: lostfoundItems.id,
      type: lostfoundItems.type,
      title: lostfoundItems.title,
      content: lostfoundItems.content,
      location: lostfoundItems.location,
      occurredAt: lostfoundItems.occurredAt,
      contactInfo: lostfoundItems.contactInfo,
      status: lostfoundItems.status,
      publishAt: lostfoundItems.publishAt,
      rejectReason: lostfoundItems.rejectReason,
      reviewedBy: lostfoundItems.reviewedBy,
      reviewedAt: lostfoundItems.reviewedAt,
      offlineReason: lostfoundItems.offlineReason,
      offlinedBy: lostfoundItems.offlinedBy,
      offlinedAt: lostfoundItems.offlinedAt,
      solvedAt: lostfoundItems.solvedAt,
      createdBy: lostfoundItems.createdBy,
      authorName: profiles.name,
      authorStudentId: profiles.studentId,
      authorEmail: authUsers.email,
      createdAt: lostfoundItems.createdAt,
      updatedAt: lostfoundItems.updatedAt,
    })
    .from(lostfoundItems)
    .leftJoin(profiles, eq(profiles.id, lostfoundItems.createdBy))
    .leftJoin(authUsers, eq(authUsers.id, lostfoundItems.createdBy))
    .where(and(eq(lostfoundItems.id, params.itemId), isNull(lostfoundItems.deletedAt)))
    .limit(1);

  const item = rows[0];
  if (!item) throw notFound();

  const images = await db
    .select({ bucket: lostfoundItemImages.bucket, key: lostfoundItemImages.key, sortNo: lostfoundItemImages.sortNo })
    .from(lostfoundItemImages)
    .where(eq(lostfoundItemImages.itemId, item.id))
    .orderBy(asc(lostfoundItemImages.sortNo), asc(lostfoundItemImages.id));

  const signedImages = await Promise.all(images.map((img) => toSignedImage({ bucket: img.bucket, key: img.key })));

  return {
    id: item.id,
    type: item.type as LostfoundType,
    title: item.title,
    content: item.content,
    location: item.location ?? null,
    occurredAt: item.occurredAt,
    contactInfo: item.contactInfo ?? null,
    status: item.status as LostfoundStatus,
    publishedAt: item.publishAt,
    solvedAt: item.solvedAt,
    rejectReason: item.rejectReason ?? null,
    review: { reviewedBy: item.reviewedBy ?? null, reviewedAt: item.reviewedAt ?? null },
    offline: { offlinedBy: item.offlinedBy ?? null, offlinedAt: item.offlinedAt ?? null, reason: item.offlineReason ?? null },
    images: signedImages,
    createdBy: { id: item.createdBy, name: item.authorName ?? "—", studentId: item.authorStudentId ?? "—", email: item.authorEmail ?? null },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function approveConsoleLostfound(params: { itemId: string; actor: AuditActor; request: RequestContext }) {
  requireUuid(params.itemId, "id");

  const before = await getLostfoundAuditSnapshot(params.itemId);
  if (!before) throw notFound();
  if (before.status !== "pending") throw conflict("仅待审核条目允许通过");

  try {
    await db
      .update(lostfoundItems)
      .set({
        status: "published",
        publishAt: sql`now()`,
        reviewedBy: params.actor.userId,
        reviewedAt: sql`now()`,
        rejectReason: null,
        offlineReason: null,
        offlinedBy: null,
        offlinedAt: null,
        updatedBy: params.actor.userId,
      })
      .where(eq(lostfoundItems.id, params.itemId));

    const after = await getLostfoundAuditSnapshot(params.itemId);

    await writeAuditLog({
      actor: params.actor,
      action: "lostfound.review.approve",
      targetType: "lostfound_item",
      targetId: params.itemId,
      success: true,
      diff: { before, after },
      request: params.request,
    });

    return { ok: true as const };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "lostfound.review.approve",
      targetType: "lostfound_item",
      targetId: params.itemId,
      success: false,
      errorCode: toErrorCode(err),
      diff: { before },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function rejectConsoleLostfound(params: { itemId: string; reason: string; actor: AuditActor; request: RequestContext }) {
  requireUuid(params.itemId, "id");

  const before = await getLostfoundAuditSnapshot(params.itemId);
  if (!before) throw notFound();
  if (before.status !== "pending") throw conflict("仅待审核条目允许驳回");

  const reason = params.reason.trim();
  if (!reason) throw badRequest("reason 必填");

  try {
    await db
      .update(lostfoundItems)
      .set({
        status: "rejected",
        publishAt: null,
        reviewedBy: params.actor.userId,
        reviewedAt: sql`now()`,
        rejectReason: reason,
        offlineReason: null,
        offlinedBy: null,
        offlinedAt: null,
        updatedBy: params.actor.userId,
      })
      .where(eq(lostfoundItems.id, params.itemId));

    const after = await getLostfoundAuditSnapshot(params.itemId);

    await writeAuditLog({
      actor: params.actor,
      action: "lostfound.review.reject",
      targetType: "lostfound_item",
      targetId: params.itemId,
      success: true,
      reason,
      diff: { before, after },
      request: params.request,
    });

    return { ok: true as const };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "lostfound.review.reject",
      targetType: "lostfound_item",
      targetId: params.itemId,
      success: false,
      errorCode: toErrorCode(err),
      reason,
      diff: { before },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function offlineConsoleLostfound(params: { itemId: string; reason: string; actor: AuditActor; request: RequestContext }) {
  requireUuid(params.itemId, "id");

  const before = await getLostfoundAuditSnapshot(params.itemId);
  if (!before) throw notFound();
  if (before.status !== "published") throw conflict("仅已发布条目允许下架");

  const reason = params.reason.trim();
  if (!reason) throw badRequest("reason 必填");

  try {
    await db
      .update(lostfoundItems)
      .set({
        status: "offline",
        offlineReason: reason,
        offlinedBy: params.actor.userId,
        offlinedAt: sql`now()`,
        updatedBy: params.actor.userId,
      })
      .where(eq(lostfoundItems.id, params.itemId));

    const after = await getLostfoundAuditSnapshot(params.itemId);

    await writeAuditLog({
      actor: params.actor,
      action: "lostfound.offline",
      targetType: "lostfound_item",
      targetId: params.itemId,
      success: true,
      reason,
      diff: { before, after },
      request: params.request,
    });

    return { ok: true as const };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "lostfound.offline",
      targetType: "lostfound_item",
      targetId: params.itemId,
      success: false,
      errorCode: toErrorCode(err),
      reason,
      diff: { before },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function restoreConsoleLostfound(params: { itemId: string; actor: AuditActor; request: RequestContext }) {
  requireUuid(params.itemId, "id");

  const before = await getLostfoundAuditSnapshot(params.itemId);
  if (!before) throw notFound();
  if (before.status !== "rejected" && before.status !== "offline") throw conflict("仅驳回/下架条目允许恢复为待审");

  try {
    await db
      .update(lostfoundItems)
      .set({
        status: "pending",
        publishAt: null,
        rejectReason: null,
        offlineReason: null,
        reviewedBy: null,
        reviewedAt: null,
        offlinedBy: null,
        offlinedAt: null,
        updatedBy: params.actor.userId,
      })
      .where(eq(lostfoundItems.id, params.itemId));

    const after = await getLostfoundAuditSnapshot(params.itemId);

    await writeAuditLog({
      actor: params.actor,
      action: "lostfound.restore",
      targetType: "lostfound_item",
      targetId: params.itemId,
      success: true,
      diff: { before, after },
      request: params.request,
    });

    return { ok: true as const };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "lostfound.restore",
      targetType: "lostfound_item",
      targetId: params.itemId,
      success: false,
      errorCode: toErrorCode(err),
      diff: { before },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function deleteConsoleLostfound(params: { itemId: string; actor: AuditActor; request: RequestContext }) {
  requireUuid(params.itemId, "id");

  const before = await getLostfoundAuditSnapshot(params.itemId);
  if (!before) throw notFound();

  try {
    await db
      .update(lostfoundItems)
      .set({ deletedAt: sql`now()`, updatedBy: params.actor.userId })
      .where(eq(lostfoundItems.id, params.itemId));

    await writeAuditLog({
      actor: params.actor,
      action: "lostfound.delete",
      targetType: "lostfound_item",
      targetId: params.itemId,
      success: true,
      diff: { before },
      request: params.request,
    });

    return { ok: true as const };
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "lostfound.delete",
      targetType: "lostfound_item",
      targetId: params.itemId,
      success: false,
      errorCode: toErrorCode(err),
      diff: { before },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}
