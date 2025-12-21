import "server-only";

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { HttpError, badRequest, conflict, notFound } from "@/lib/http/errors";
import { requireUuid } from "@/lib/http/uuid";
import type { RequestContext } from "@/lib/http/route";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import { writeAuditLog } from "@/lib/modules/audit/audit.service";
import { normalizeExternalUrl } from "@/lib/modules/course-resources/courseResources.utils";
import {
  assertLibraryFile,
  LIBRARY_BOOKS_BUCKET,
  type LibraryBookStatus,
  type LibraryFileFormat,
  pickDefaultDownloadAssetId,
  normalizeIsbn13,
} from "@/lib/modules/library/library.utils";
import { sanitizeStorageObjectKeyPart } from "@/lib/utils/fileName";
import { storageAdapter } from "@/lib/storage";
import { authUsers, libraryBookAssets, libraryBookDownloadEvents, libraryBookFavorites, libraryBooks, profiles } from "@campus-hub/db";

const SIGNED_URL_EXPIRES_IN = 60;

type BookStatus = LibraryBookStatus;
type FileFormat = LibraryFileFormat;

type BookRow = {
  id: string;
  isbn13: string;
  title: string;
  author: string;
  summary: string | null;
  keywords: string | null;
  status: BookStatus;
  submittedAt: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
  publishedAt: Date | null;
  unpublishedAt: Date | null;
  downloadCount: number;
  lastDownloadAt: Date | null;
  createdBy: string;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AssetRow = {
  id: string;
  bookId: string;
  assetType: "file" | "link";
  fileFormat: FileFormat | null;
  fileBucket: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  contentType: string | null;
  linkUrl: string | null;
  linkUrlNormalized: string | null;
  createdAt: Date;
};

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

function assertEditableStatus(status: BookStatus) {
  if (status === "draft" || status === "rejected" || status === "unpublished") return;
  throw conflict("仅 draft/rejected/unpublished 状态允许修改");
}

function assertDeletableStatus(status: BookStatus) {
  if (status === "draft" || status === "rejected" || status === "unpublished") return;
  throw conflict("仅 draft/rejected/unpublished 状态允许删除");
}

function assertSubmittableStatus(status: BookStatus) {
  if (status === "draft" || status === "rejected" || status === "unpublished") return;
  throw conflict("仅 draft/rejected/unpublished 状态允许提交审核");
}

function assertDays(days: number) {
  if (days === 7 || days === 30 || days === 365) return;
  throw badRequest("days 仅支持 7/30/365");
}

async function getBookRow(bookId: string): Promise<BookRow | null> {
  const rows = await db
    .select({
      id: libraryBooks.id,
      isbn13: libraryBooks.isbn13,
      title: libraryBooks.title,
      author: libraryBooks.author,
      summary: libraryBooks.summary,
      keywords: libraryBooks.keywords,
      status: libraryBooks.status,
      submittedAt: libraryBooks.submittedAt,
      reviewedBy: libraryBooks.reviewedBy,
      reviewedAt: libraryBooks.reviewedAt,
      reviewComment: libraryBooks.reviewComment,
      publishedAt: libraryBooks.publishedAt,
      unpublishedAt: libraryBooks.unpublishedAt,
      downloadCount: libraryBooks.downloadCount,
      lastDownloadAt: libraryBooks.lastDownloadAt,
      createdBy: libraryBooks.createdBy,
      authorName: profiles.name,
      authorEmail: authUsers.email,
      createdAt: libraryBooks.createdAt,
      updatedBy: libraryBooks.updatedBy,
      updatedAt: libraryBooks.updatedAt,
      deletedAt: libraryBooks.deletedAt,
    })
    .from(libraryBooks)
    .innerJoin(profiles, eq(profiles.id, libraryBooks.createdBy))
    .leftJoin(authUsers, eq(authUsers.id, libraryBooks.createdBy))
    .where(eq(libraryBooks.id, bookId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    isbn13: row.isbn13,
    title: row.title,
    author: row.author,
    summary: row.summary ?? null,
    keywords: row.keywords ?? null,
    status: row.status as BookStatus,
    submittedAt: row.submittedAt,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    reviewComment: row.reviewComment ?? null,
    publishedAt: row.publishedAt,
    unpublishedAt: row.unpublishedAt,
    downloadCount: row.downloadCount,
    lastDownloadAt: row.lastDownloadAt,
    createdBy: row.createdBy,
    authorName: row.authorName ?? null,
    authorEmail: row.authorEmail ?? null,
    createdAt: row.createdAt,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

async function listBookAssets(bookId: string): Promise<AssetRow[]> {
  const rows = await db
    .select({
      id: libraryBookAssets.id,
      bookId: libraryBookAssets.bookId,
      assetType: libraryBookAssets.assetType,
      fileFormat: libraryBookAssets.fileFormat,
      fileBucket: libraryBookAssets.fileBucket,
      fileKey: libraryBookAssets.fileKey,
      fileName: libraryBookAssets.fileName,
      fileSize: libraryBookAssets.fileSize,
      contentType: libraryBookAssets.contentType,
      linkUrl: libraryBookAssets.linkUrl,
      linkUrlNormalized: libraryBookAssets.linkUrlNormalized,
      createdAt: libraryBookAssets.createdAt,
    })
    .from(libraryBookAssets)
    .where(eq(libraryBookAssets.bookId, bookId))
    .orderBy(asc(libraryBookAssets.createdAt));

  return rows.map((r) => ({
    id: r.id,
    bookId: r.bookId,
    assetType: r.assetType as "file" | "link",
    fileFormat: (r.fileFormat as FileFormat | null) ?? null,
    fileBucket: r.fileBucket ?? null,
    fileKey: r.fileKey ?? null,
    fileName: r.fileName ?? null,
    fileSize: r.fileSize ?? null,
    contentType: r.contentType ?? null,
    linkUrl: r.linkUrl ?? null,
    linkUrlNormalized: r.linkUrlNormalized ?? null,
    createdAt: r.createdAt,
  }));
}

function toAssetDto(row: AssetRow) {
  return {
    id: row.id,
    assetType: row.assetType,
    fileFormat: row.fileFormat,
    file:
      row.assetType === "file" && row.fileBucket && row.fileKey && row.fileName && row.fileSize != null
        ? {
            bucket: row.fileBucket,
            key: row.fileKey,
            fileName: row.fileName,
            size: row.fileSize,
          }
        : null,
    link:
      row.assetType === "link" && row.linkUrl && row.linkUrlNormalized
        ? { url: row.linkUrl, normalizedUrl: row.linkUrlNormalized }
        : null,
    createdAt: row.createdAt,
  };
}

function buildAssetMeta(rows: Array<Pick<AssetRow, "assetType" | "fileFormat">>) {
  const formats = new Set<FileFormat>();
  let hasLinkAssets = false;
  for (const a of rows) {
    if (a.assetType === "link") hasLinkAssets = true;
    if (a.assetType === "file" && a.fileFormat) formats.add(a.fileFormat);
  }
  return { assetFormats: [...formats], hasLinkAssets };
}

function buildBookListItem(params: {
  row: BookRow;
  assetMeta: { assetFormats: FileFormat[]; hasLinkAssets: boolean };
  isFavorite: boolean;
}) {
  const r = params.row;
  return {
    id: r.id,
    isbn13: r.isbn13,
    title: r.title,
    author: r.author,
    summary: r.summary,
    keywords: r.keywords,
    status: r.status,
    downloadCount: r.downloadCount,
    assetFormats: params.assetMeta.assetFormats,
    hasLinkAssets: params.assetMeta.hasLinkAssets,
    isFavorite: params.isFavorite,
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt,
    publishedAt: r.publishedAt,
    unpublishedAt: r.unpublishedAt,
    createdBy: r.createdBy,
    authorName: r.authorName,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function getFavoriteSet(userId: string, bookIds: string[]) {
  if (bookIds.length === 0) return new Set<string>();

  const rows = await db
    .select({ bookId: libraryBookFavorites.bookId })
    .from(libraryBookFavorites)
    .where(and(eq(libraryBookFavorites.userId, userId), inArray(libraryBookFavorites.bookId, bookIds)));
  return new Set(rows.map((r) => r.bookId));
}

async function getAssetsForBooks(bookIds: string[]) {
  if (bookIds.length === 0) return new Map<string, AssetRow[]>();

  const rows = await db
    .select({
      id: libraryBookAssets.id,
      bookId: libraryBookAssets.bookId,
      assetType: libraryBookAssets.assetType,
      fileFormat: libraryBookAssets.fileFormat,
      fileBucket: libraryBookAssets.fileBucket,
      fileKey: libraryBookAssets.fileKey,
      fileName: libraryBookAssets.fileName,
      fileSize: libraryBookAssets.fileSize,
      contentType: libraryBookAssets.contentType,
      linkUrl: libraryBookAssets.linkUrl,
      linkUrlNormalized: libraryBookAssets.linkUrlNormalized,
      createdAt: libraryBookAssets.createdAt,
    })
    .from(libraryBookAssets)
    .where(inArray(libraryBookAssets.bookId, bookIds))
    .orderBy(asc(libraryBookAssets.createdAt));

  const map = new Map<string, AssetRow[]>();
  for (const r of rows) {
    const item: AssetRow = {
      id: r.id,
      bookId: r.bookId,
      assetType: r.assetType as "file" | "link",
      fileFormat: (r.fileFormat as FileFormat | null) ?? null,
      fileBucket: r.fileBucket ?? null,
      fileKey: r.fileKey ?? null,
      fileName: r.fileName ?? null,
      fileSize: r.fileSize ?? null,
      contentType: r.contentType ?? null,
      linkUrl: r.linkUrl ?? null,
      linkUrlNormalized: r.linkUrlNormalized ?? null,
      createdAt: r.createdAt,
    };
    const list = map.get(item.bookId) ?? [];
    list.push(item);
    map.set(item.bookId, list);
  }
  return map;
}

async function ensureIsbnUnique(params: { isbn13: string; excludeBookId?: string }) {
  const where = [eq(libraryBooks.isbn13, params.isbn13)];
  if (params.excludeBookId) where.push(sql`${libraryBooks.id} <> ${params.excludeBookId}`);

  const exists = await db.select({ id: libraryBooks.id }).from(libraryBooks).where(and(...where)).limit(1);
  if (exists[0]) throw conflict("ISBN 冲突：该 ISBN 已存在");
}

export async function listPortalLibraryBooks(params: {
  userId: string;
  page: number;
  pageSize: number;
  q?: string;
  format?: FileFormat;
  sortBy?: "publishedAt" | "downloadCount";
  sortOrder?: "asc" | "desc";
}) {
  const where = [isNull(libraryBooks.deletedAt), eq(libraryBooks.status, "published")];

  if (params.q && params.q.trim()) {
    const raw = params.q.trim();
    const digits = raw.replace(/[^0-9]/g, "");
    const pattern = `%${raw}%`;
    const isbnPattern = digits ? `%${digits}%` : pattern;
    where.push(
      or(
        sql`${libraryBooks.title} ilike ${pattern}`,
        sql`${libraryBooks.author} ilike ${pattern}`,
        sql`${libraryBooks.keywords} ilike ${pattern}`,
        sql`${libraryBooks.isbn13} ilike ${isbnPattern}`,
      )!,
    );
  }

  if (params.format) {
    where.push(
      sql`exists (
        select 1
        from public.library_book_assets a
        where a.book_id = ${libraryBooks.id}
          and a.asset_type = 'file'
          and a.file_format = ${params.format}
      )`,
    );
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(libraryBooks)
    .where(and(...where));

  const dir = params.sortOrder === "asc" ? asc : desc;
  const orderBy = [];
  if (params.sortBy === "downloadCount") orderBy.push(dir(libraryBooks.downloadCount));
  else orderBy.push(dir(libraryBooks.publishedAt));
  orderBy.push(desc(libraryBooks.createdAt));

  const rows = await db
    .select({
      id: libraryBooks.id,
      isbn13: libraryBooks.isbn13,
      title: libraryBooks.title,
      author: libraryBooks.author,
      summary: libraryBooks.summary,
      keywords: libraryBooks.keywords,
      status: libraryBooks.status,
      submittedAt: libraryBooks.submittedAt,
      reviewedBy: libraryBooks.reviewedBy,
      reviewedAt: libraryBooks.reviewedAt,
      reviewComment: libraryBooks.reviewComment,
      publishedAt: libraryBooks.publishedAt,
      unpublishedAt: libraryBooks.unpublishedAt,
      downloadCount: libraryBooks.downloadCount,
      lastDownloadAt: libraryBooks.lastDownloadAt,
      createdBy: libraryBooks.createdBy,
      authorName: profiles.name,
      authorEmail: authUsers.email,
      createdAt: libraryBooks.createdAt,
      updatedBy: libraryBooks.updatedBy,
      updatedAt: libraryBooks.updatedAt,
      deletedAt: libraryBooks.deletedAt,
    })
    .from(libraryBooks)
    .innerJoin(profiles, eq(profiles.id, libraryBooks.createdBy))
    .leftJoin(authUsers, eq(authUsers.id, libraryBooks.createdBy))
    .where(and(...where))
    .orderBy(...orderBy)
    .limit(params.pageSize)
    .offset(offset);

  const bookIds = rows.map((r) => r.id);
  const assetsByBookId = await getAssetsForBooks(bookIds);
  const favoriteSet = await getFavoriteSet(params.userId, bookIds);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => {
      const row = r as unknown as BookRow;
      const assets = assetsByBookId.get(row.id) ?? [];
      const meta = buildAssetMeta(assets);
      return buildBookListItem({ row, assetMeta: meta, isFavorite: favoriteSet.has(row.id) });
    }),
  };
}

export async function getPortalLibraryBookDetail(params: { userId: string; bookId: string }) {
  requireUuid(params.bookId, "id");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();
  if (row.status !== "published") throw notFound();

  const assets = await listBookAssets(row.id);
  const favorite = await db
    .select({ bookId: libraryBookFavorites.bookId })
    .from(libraryBookFavorites)
    .where(and(eq(libraryBookFavorites.userId, params.userId), eq(libraryBookFavorites.bookId, row.id)))
    .limit(1);

  return {
    id: row.id,
    isbn13: row.isbn13,
    title: row.title,
    author: row.author,
    summary: row.summary,
    keywords: row.keywords,
    status: row.status,
    assets: assets.map(toAssetDto),
    isFavorite: !!favorite[0],
    review: { reviewedBy: row.reviewedBy, reviewedAt: row.reviewedAt, comment: row.reviewComment },
    submittedAt: row.submittedAt,
    publishedAt: row.publishedAt,
    unpublishedAt: row.unpublishedAt,
    downloadCount: row.downloadCount,
    lastDownloadAt: row.lastDownloadAt,
    createdBy: row.createdBy,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    createdAt: row.createdAt,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

export async function setPortalLibraryBookFavorite(params: { userId: string; bookId: string; favorite: boolean }) {
  requireUuid(params.bookId, "id");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();
  if (row.status !== "published") throw notFound();

  if (params.favorite) {
    await db.insert(libraryBookFavorites).values({ bookId: row.id, userId: params.userId }).onConflictDoNothing();
  } else {
    await db.delete(libraryBookFavorites).where(and(eq(libraryBookFavorites.bookId, row.id), eq(libraryBookFavorites.userId, params.userId)));
  }

  return { ok: true as const, favorite: params.favorite };
}

export async function downloadPortalLibraryBook(params: {
  userId: string;
  bookId: string;
  assetId?: string;
  request: RequestContext;
}) {
  requireUuid(params.bookId, "id");
  if (params.assetId) requireUuid(params.assetId, "assetId");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();
  if (row.status !== "published") throw notFound();

  const assets = await listBookAssets(row.id);
  const defaultAssetId = pickDefaultDownloadAssetId(assets);
  const selectedAssetId = params.assetId ?? defaultAssetId;
  if (!selectedAssetId) throw conflict("该图书暂无可下载资产");

  const asset = assets.find((a) => a.id === selectedAssetId);
  if (!asset) throw notFound("资产不存在或不可见");

  let redirectUrl: string;
  if (asset.assetType === "file") {
    if (!asset.fileBucket || !asset.fileKey) throw conflict("文件信息不完整");
    const signed = await storageAdapter.createSignedDownloadUrl({
      bucket: asset.fileBucket,
      key: asset.fileKey,
      expiresIn: SIGNED_URL_EXPIRES_IN,
      download: asset.fileName ?? true,
    });
    redirectUrl = signed.signedUrl;
  } else {
    if (!asset.linkUrlNormalized) throw conflict("外链信息不完整");
    redirectUrl = asset.linkUrlNormalized;
  }

  await db.transaction(async (tx) => {
    await tx.insert(libraryBookDownloadEvents).values({
      bookId: row.id,
      assetId: asset.id,
      userId: params.userId,
      ip: params.request.ip,
      userAgent: params.request.userAgent,
    });

    await tx
      .update(libraryBooks)
      .set({ downloadCount: sql`${libraryBooks.downloadCount} + 1`, lastDownloadAt: sql`now()` })
      .where(eq(libraryBooks.id, row.id));
  });

  return { redirectUrl };
}

export async function getPortalLibraryBookDownloadLeaderboard(params: { userId: string; days?: number }) {
  const days = params.days;

  if (!days) {
    const rows = await db
      .select({
        id: libraryBooks.id,
        isbn13: libraryBooks.isbn13,
        title: libraryBooks.title,
        author: libraryBooks.author,
        summary: libraryBooks.summary,
        keywords: libraryBooks.keywords,
        status: libraryBooks.status,
        submittedAt: libraryBooks.submittedAt,
        reviewedBy: libraryBooks.reviewedBy,
        reviewedAt: libraryBooks.reviewedAt,
        reviewComment: libraryBooks.reviewComment,
        publishedAt: libraryBooks.publishedAt,
        unpublishedAt: libraryBooks.unpublishedAt,
        downloadCount: libraryBooks.downloadCount,
        lastDownloadAt: libraryBooks.lastDownloadAt,
        createdBy: libraryBooks.createdBy,
        authorName: profiles.name,
        authorEmail: authUsers.email,
        createdAt: libraryBooks.createdAt,
        updatedBy: libraryBooks.updatedBy,
        updatedAt: libraryBooks.updatedAt,
        deletedAt: libraryBooks.deletedAt,
      })
      .from(libraryBooks)
      .innerJoin(profiles, eq(profiles.id, libraryBooks.createdBy))
      .leftJoin(authUsers, eq(authUsers.id, libraryBooks.createdBy))
      .where(and(isNull(libraryBooks.deletedAt), eq(libraryBooks.status, "published")))
      .orderBy(desc(libraryBooks.downloadCount), desc(libraryBooks.publishedAt), desc(libraryBooks.createdAt))
      .limit(20);

    const bookIds = rows.map((r) => r.id);
    const assetsByBookId = await getAssetsForBooks(bookIds);
    const favoriteSet = await getFavoriteSet(params.userId, bookIds);

    return {
      days: 0,
      items: rows.map((r) => {
        const row = r as unknown as BookRow;
        const meta = buildAssetMeta(assetsByBookId.get(row.id) ?? []);
        return {
          book: buildBookListItem({ row, assetMeta: meta, isFavorite: favoriteSet.has(row.id) }),
          windowDownloadCount: row.downloadCount,
        };
      }),
    };
  }

  assertDays(days);

  const since = sql`now() - (${days}::int * interval '1 day')`;

  const rows = await db
    .select({
      bookId: libraryBookDownloadEvents.bookId,
      windowDownloadCount: sql<number>`count(*)`.as("windowDownloadCount"),
    })
    .from(libraryBookDownloadEvents)
    .innerJoin(libraryBooks, eq(libraryBooks.id, libraryBookDownloadEvents.bookId))
    .where(and(isNull(libraryBooks.deletedAt), eq(libraryBooks.status, "published"), sql`${libraryBookDownloadEvents.occurredAt} >= ${since}`))
    .groupBy(libraryBookDownloadEvents.bookId)
    .orderBy(desc(sql<number>`count(*)`), desc(libraryBookDownloadEvents.bookId))
    .limit(20);

  const bookIds = rows.map((r) => r.bookId);
  const books = await db
    .select({
      id: libraryBooks.id,
      isbn13: libraryBooks.isbn13,
      title: libraryBooks.title,
      author: libraryBooks.author,
      summary: libraryBooks.summary,
      keywords: libraryBooks.keywords,
      status: libraryBooks.status,
      submittedAt: libraryBooks.submittedAt,
      reviewedBy: libraryBooks.reviewedBy,
      reviewedAt: libraryBooks.reviewedAt,
      reviewComment: libraryBooks.reviewComment,
      publishedAt: libraryBooks.publishedAt,
      unpublishedAt: libraryBooks.unpublishedAt,
      downloadCount: libraryBooks.downloadCount,
      lastDownloadAt: libraryBooks.lastDownloadAt,
      createdBy: libraryBooks.createdBy,
      authorName: profiles.name,
      authorEmail: authUsers.email,
      createdAt: libraryBooks.createdAt,
      updatedBy: libraryBooks.updatedBy,
      updatedAt: libraryBooks.updatedAt,
      deletedAt: libraryBooks.deletedAt,
    })
    .from(libraryBooks)
    .innerJoin(profiles, eq(profiles.id, libraryBooks.createdBy))
    .leftJoin(authUsers, eq(authUsers.id, libraryBooks.createdBy))
    .where(inArray(libraryBooks.id, bookIds));

  const byId = new Map(books.map((b) => [b.id, b as unknown as BookRow]));
  const assetsByBookId = await getAssetsForBooks(bookIds);
  const favoriteSet = await getFavoriteSet(params.userId, bookIds);

  return {
    days,
    items: rows
      .map((r) => {
        const book = byId.get(r.bookId);
        if (!book) return null;
        const meta = buildAssetMeta(assetsByBookId.get(book.id) ?? []);
        return {
          book: buildBookListItem({ row: book, assetMeta: meta, isFavorite: favoriteSet.has(book.id) }),
          windowDownloadCount: Number(r.windowDownloadCount ?? 0),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };
}

export async function getPortalLibraryContributorLeaderboard(params: { userId: string; days?: number }) {
  const days = params.days;

  const where = [isNull(libraryBooks.deletedAt), eq(libraryBooks.status, "published")];
  if (days) {
    assertDays(days);
    where.push(sql`${libraryBooks.publishedAt} >= (now() - (${days}::int * interval '1 day'))`);
  }

  const rows = await db
    .select({
      userId: libraryBooks.createdBy,
      publishedBookCount: sql<number>`count(*)`.as("publishedBookCount"),
    })
    .from(libraryBooks)
    .where(and(...where))
    .groupBy(libraryBooks.createdBy)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(20);

  const userIds = rows.map((r) => r.userId);
  const profileRows = userIds.length
    ? await db.select({ id: profiles.id, name: profiles.name }).from(profiles).where(inArray(profiles.id, userIds))
    : [];
  const nameById = new Map(profileRows.map((p) => [p.id, p.name]));

  return {
    days: days ?? 0,
    items: rows.map((r) => ({
      userId: r.userId,
      name: nameById.get(r.userId) ?? "—",
      publishedBookCount: Number(r.publishedBookCount ?? 0),
    })),
  };
}

export async function listMyLibraryBooks(params: { userId: string; page: number; pageSize: number; status?: BookStatus; q?: string }) {
  const where = [isNull(libraryBooks.deletedAt), eq(libraryBooks.createdBy, params.userId)];

  if (params.status) where.push(eq(libraryBooks.status, params.status));
  if (params.q && params.q.trim()) {
    const raw = params.q.trim();
    const digits = raw.replace(/[^0-9]/g, "");
    const pattern = `%${raw}%`;
    const isbnPattern = digits ? `%${digits}%` : pattern;
    where.push(
      or(
        sql`${libraryBooks.title} ilike ${pattern}`,
        sql`${libraryBooks.author} ilike ${pattern}`,
        sql`${libraryBooks.keywords} ilike ${pattern}`,
        sql`${libraryBooks.isbn13} ilike ${isbnPattern}`,
      )!,
    );
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(libraryBooks)
    .where(and(...where));

  const rows = await db
    .select({
      id: libraryBooks.id,
      isbn13: libraryBooks.isbn13,
      title: libraryBooks.title,
      author: libraryBooks.author,
      summary: libraryBooks.summary,
      keywords: libraryBooks.keywords,
      status: libraryBooks.status,
      submittedAt: libraryBooks.submittedAt,
      reviewedBy: libraryBooks.reviewedBy,
      reviewedAt: libraryBooks.reviewedAt,
      reviewComment: libraryBooks.reviewComment,
      publishedAt: libraryBooks.publishedAt,
      unpublishedAt: libraryBooks.unpublishedAt,
      downloadCount: libraryBooks.downloadCount,
      lastDownloadAt: libraryBooks.lastDownloadAt,
      createdBy: libraryBooks.createdBy,
      authorName: profiles.name,
      authorEmail: authUsers.email,
      createdAt: libraryBooks.createdAt,
      updatedBy: libraryBooks.updatedBy,
      updatedAt: libraryBooks.updatedAt,
      deletedAt: libraryBooks.deletedAt,
    })
    .from(libraryBooks)
    .innerJoin(profiles, eq(profiles.id, libraryBooks.createdBy))
    .leftJoin(authUsers, eq(authUsers.id, libraryBooks.createdBy))
    .where(and(...where))
    .orderBy(desc(libraryBooks.createdAt))
    .limit(params.pageSize)
    .offset(offset);

  const bookIds = rows.map((r) => r.id);
  const assetsByBookId = await getAssetsForBooks(bookIds);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => {
      const row = r as unknown as BookRow;
      const meta = buildAssetMeta(assetsByBookId.get(row.id) ?? []);
      return buildBookListItem({ row, assetMeta: meta, isFavorite: false });
    }),
  };
}

export async function getMyLibraryBookDetail(params: { userId: string; bookId: string }) {
  requireUuid(params.bookId, "id");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();
  if (row.createdBy !== params.userId) throw notFound();

  const assets = await listBookAssets(row.id);

  return {
    id: row.id,
    isbn13: row.isbn13,
    title: row.title,
    author: row.author,
    summary: row.summary,
    keywords: row.keywords,
    status: row.status,
    assets: assets.map(toAssetDto),
    isFavorite: false,
    review: { reviewedBy: row.reviewedBy, reviewedAt: row.reviewedAt, comment: row.reviewComment },
    submittedAt: row.submittedAt,
    publishedAt: row.publishedAt,
    unpublishedAt: row.unpublishedAt,
    downloadCount: row.downloadCount,
    lastDownloadAt: row.lastDownloadAt,
    createdBy: row.createdBy,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    createdAt: row.createdAt,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

export async function createMyLibraryBookDraft(params: {
  userId: string;
  isbn13: string;
  title: string;
  author: string;
  summary?: string | null;
  keywords?: string | null;
}) {
  const isbn13 = normalizeIsbn13(params.isbn13);
  await ensureIsbnUnique({ isbn13 });

  const inserted = await db
    .insert(libraryBooks)
    .values({
      isbn13,
      title: params.title.trim(),
      author: params.author.trim(),
      summary: params.summary?.trim() ? params.summary.trim() : null,
      keywords: params.keywords?.trim() ? params.keywords.trim() : null,
      status: "draft",
      createdBy: params.userId,
      updatedBy: params.userId,
    })
    .returning({ id: libraryBooks.id });

  const id = inserted[0]?.id;
  if (!id) throw badRequest("创建草稿失败");
  return getMyLibraryBookDetail({ userId: params.userId, bookId: id });
}

export async function updateMyLibraryBook(params: {
  userId: string;
  bookId: string;
  patch: { isbn13?: string; title?: string; author?: string; summary?: string | null; keywords?: string | null };
}) {
  requireUuid(params.bookId, "id");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();
  if (row.createdBy !== params.userId) throw notFound();
  assertEditableStatus(row.status);

  const patch: Record<string, unknown> = {};
  if (typeof params.patch.title !== "undefined") patch.title = params.patch.title.trim();
  if (typeof params.patch.author !== "undefined") patch.author = params.patch.author.trim();
  if (typeof params.patch.summary !== "undefined") patch.summary = params.patch.summary?.trim() ? params.patch.summary.trim() : null;
  if (typeof params.patch.keywords !== "undefined") patch.keywords = params.patch.keywords?.trim() ? params.patch.keywords.trim() : null;

  if (typeof params.patch.isbn13 !== "undefined") {
    const isbn13 = normalizeIsbn13(params.patch.isbn13);
    await ensureIsbnUnique({ isbn13, excludeBookId: row.id });
    patch.isbn13 = isbn13;
  }

  patch.updatedBy = params.userId;

  try {
    await db.update(libraryBooks).set(patch).where(eq(libraryBooks.id, row.id));
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") throw conflict("ISBN 冲突：该 ISBN 已存在");
    throw err;
  }

  return getMyLibraryBookDetail({ userId: params.userId, bookId: row.id });
}

export async function deleteMyLibraryBook(params: { userId: string; bookId: string }) {
  requireUuid(params.bookId, "id");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();
  if (row.createdBy !== params.userId) throw notFound();

  assertDeletableStatus(row.status);

  const assets = await listBookAssets(row.id);
  const fileKeys = assets
    .filter((a) => a.assetType === "file" && a.fileBucket && a.fileKey)
    .map((a) => ({ bucket: a.fileBucket!, key: a.fileKey! }));

  for (const bucket of new Set(fileKeys.map((k) => k.bucket))) {
    const keys = fileKeys.filter((k) => k.bucket === bucket).map((k) => k.key);
    if (keys.length === 0) continue;
    await storageAdapter.remove({ bucket, keys }).catch(() => {});
  }

  await db.update(libraryBooks).set({ deletedAt: sql`now()`, updatedBy: params.userId }).where(eq(libraryBooks.id, row.id));

  return { ok: true as const };
}

export async function submitMyLibraryBook(params: { userId: string; bookId: string }) {
  requireUuid(params.bookId, "id");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();
  if (row.createdBy !== params.userId) throw notFound();

  assertSubmittableStatus(row.status);

  const assetCountRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(libraryBookAssets)
    .where(eq(libraryBookAssets.bookId, row.id));
  const assetCount = Number(assetCountRow[0]?.total ?? 0);
  if (assetCount <= 0) throw badRequest("至少添加 1 个资产后才能提交审核");

  await db
    .update(libraryBooks)
    .set({
      status: "pending",
      submittedAt: sql`now()`,
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
      updatedBy: params.userId,
    })
    .where(eq(libraryBooks.id, row.id));

  return getMyLibraryBookDetail({ userId: params.userId, bookId: row.id });
}

export async function unpublishMyLibraryBook(params: { userId: string; bookId: string }) {
  requireUuid(params.bookId, "id");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();
  if (row.createdBy !== params.userId) throw notFound();

  if (row.status !== "published") throw conflict("仅已发布图书允许下架");

  await db
    .update(libraryBooks)
    .set({ status: "unpublished", unpublishedAt: sql`now()`, updatedBy: params.userId })
    .where(eq(libraryBooks.id, row.id));

  return getMyLibraryBookDetail({ userId: params.userId, bookId: row.id });
}

export async function listMyFavoriteLibraryBooks(params: { userId: string; page: number; pageSize: number }) {
  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(libraryBookFavorites)
    .innerJoin(libraryBooks, eq(libraryBooks.id, libraryBookFavorites.bookId))
    .where(and(eq(libraryBookFavorites.userId, params.userId), isNull(libraryBooks.deletedAt), eq(libraryBooks.status, "published")));

  const rows = await db
    .select({
      id: libraryBooks.id,
      isbn13: libraryBooks.isbn13,
      title: libraryBooks.title,
      author: libraryBooks.author,
      summary: libraryBooks.summary,
      keywords: libraryBooks.keywords,
      status: libraryBooks.status,
      submittedAt: libraryBooks.submittedAt,
      reviewedBy: libraryBooks.reviewedBy,
      reviewedAt: libraryBooks.reviewedAt,
      reviewComment: libraryBooks.reviewComment,
      publishedAt: libraryBooks.publishedAt,
      unpublishedAt: libraryBooks.unpublishedAt,
      downloadCount: libraryBooks.downloadCount,
      lastDownloadAt: libraryBooks.lastDownloadAt,
      createdBy: libraryBooks.createdBy,
      authorName: profiles.name,
      authorEmail: authUsers.email,
      createdAt: libraryBooks.createdAt,
      updatedBy: libraryBooks.updatedBy,
      updatedAt: libraryBooks.updatedAt,
      deletedAt: libraryBooks.deletedAt,
    })
    .from(libraryBookFavorites)
    .innerJoin(libraryBooks, eq(libraryBooks.id, libraryBookFavorites.bookId))
    .innerJoin(profiles, eq(profiles.id, libraryBooks.createdBy))
    .leftJoin(authUsers, eq(authUsers.id, libraryBooks.createdBy))
    .where(and(eq(libraryBookFavorites.userId, params.userId), isNull(libraryBooks.deletedAt), eq(libraryBooks.status, "published")))
    .orderBy(desc(libraryBookFavorites.createdAt))
    .limit(params.pageSize)
    .offset(offset);

  const bookIds = rows.map((r) => r.id);
  const assetsByBookId = await getAssetsForBooks(bookIds);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => {
      const row = r as unknown as BookRow;
      const meta = buildAssetMeta(assetsByBookId.get(row.id) ?? []);
      return buildBookListItem({ row, assetMeta: meta, isFavorite: true });
    }),
  };
}

export async function createMyLibraryBookUploadUrl(params: {
  userId: string;
  bookId: string;
  format: FileFormat;
  fileName: string;
  size: number;
  contentType?: string;
}) {
  requireUuid(params.bookId, "id");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();
  if (row.createdBy !== params.userId) throw notFound();
  assertEditableStatus(row.status);

  assertLibraryFile({ format: params.format, fileName: params.fileName, size: params.size });

  const supabase = createSupabaseAdminClient();
  const existing = await db
    .select({ id: libraryBookAssets.id, fileKey: libraryBookAssets.fileKey, fileBucket: libraryBookAssets.fileBucket })
    .from(libraryBookAssets)
    .where(and(eq(libraryBookAssets.bookId, row.id), eq(libraryBookAssets.assetType, "file"), eq(libraryBookAssets.fileFormat, params.format)))
    .limit(1);

  const safeName = sanitizeStorageObjectKeyPart(params.fileName);
  const assetId = existing[0]?.id ?? crypto.randomUUID();
  const key = existing[0]?.fileKey ?? `library/${row.id}/${assetId}/${crypto.randomUUID()}-${safeName}`;
  const bucket = existing[0]?.fileBucket ?? LIBRARY_BOOKS_BUCKET;
  const upsert = !!existing[0]?.id;

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(key, { upsert });
  if (error || !data?.signedUrl || !data.token) {
    const { status, message } = getStorageErrorMeta(error);
    console.error("[library] createSignedUploadUrl failed", { status, message, bucket, key });

    if (status === 404 || /bucket/i.test(message)) {
      throw new HttpError(500, "INTERNAL_ERROR", "Storage bucket 不存在：请先创建 library-books", {
        bucket: LIBRARY_BOOKS_BUCKET,
      });
    }

    throw new HttpError(500, "INTERNAL_ERROR", "生成上传链接失败", { status, message });
  }

  try {
    if (existing[0]?.id) {
      await db
        .update(libraryBookAssets)
        .set({
          fileBucket: bucket,
          fileKey: key,
          fileName: params.fileName,
          fileSize: params.size,
          contentType: params.contentType?.trim() ? params.contentType.trim() : null,
        })
        .where(eq(libraryBookAssets.id, assetId));
    } else {
      await db.insert(libraryBookAssets).values({
        id: assetId,
        bookId: row.id,
        assetType: "file",
        fileFormat: params.format,
        fileBucket: bucket,
        fileKey: key,
        fileName: params.fileName,
        fileSize: params.size,
        contentType: params.contentType?.trim() ? params.contentType.trim() : null,
        linkUrl: null,
        linkUrlNormalized: null,
        createdBy: params.userId,
      });
    }
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") throw conflict("该图书下同一格式文件已存在");
    throw err;
  }

  return { assetId, bucket, key, token: data.token, uploadUrl: data.signedUrl };
}

export async function createMyLibraryBookLinkAsset(params: { userId: string; bookId: string; url: string }) {
  requireUuid(params.bookId, "id");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();
  if (row.createdBy !== params.userId) throw notFound();
  assertEditableStatus(row.status);

  const raw = params.url.trim();
  if (!raw) throw badRequest("url 不能为空");

  let normalized: string;
  try {
    normalized = normalizeExternalUrl(raw);
  } catch (err) {
    throw badRequest("外链 URL 不合法", { message: err instanceof Error ? err.message : "URL 不合法" });
  }

  try {
    await db.insert(libraryBookAssets).values({
      bookId: row.id,
      assetType: "link",
      fileFormat: null,
      fileBucket: null,
      fileKey: null,
      fileName: null,
      fileSize: null,
      contentType: null,
      linkUrl: raw,
      linkUrlNormalized: normalized,
      createdBy: params.userId,
    });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") throw conflict("该图书下已存在相同外链（规范化 URL）");
    throw err;
  }

  return getMyLibraryBookDetail({ userId: params.userId, bookId: row.id });
}

export async function deleteMyLibraryBookAsset(params: { userId: string; bookId: string; assetId: string }) {
  requireUuid(params.bookId, "id");
  requireUuid(params.assetId, "assetId");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();
  if (row.createdBy !== params.userId) throw notFound();
  assertEditableStatus(row.status);

  const assets = await listBookAssets(row.id);
  const target = assets.find((a) => a.id === params.assetId);
  if (!target) throw notFound("资产不存在或不可见");

  if (target.assetType === "file" && target.fileBucket && target.fileKey) {
    await storageAdapter.remove({ bucket: target.fileBucket, keys: [target.fileKey] }).catch(() => {});
  }

  await db.delete(libraryBookAssets).where(and(eq(libraryBookAssets.id, target.id), eq(libraryBookAssets.bookId, row.id)));

  return getMyLibraryBookDetail({ userId: params.userId, bookId: row.id });
}

async function getBookAuditSnapshot(bookId: string) {
  const row = await getBookRow(bookId);
  if (!row) return null;

  const assets = await db
    .select({
      id: libraryBookAssets.id,
      assetType: libraryBookAssets.assetType,
      fileFormat: libraryBookAssets.fileFormat,
      fileBucket: libraryBookAssets.fileBucket,
      fileKey: libraryBookAssets.fileKey,
      linkUrlNormalized: libraryBookAssets.linkUrlNormalized,
      createdAt: libraryBookAssets.createdAt,
    })
    .from(libraryBookAssets)
    .where(eq(libraryBookAssets.bookId, bookId))
    .orderBy(asc(libraryBookAssets.createdAt));

  return { ...row, assets };
}

async function assertAllFileAssetsExist(bookId: string) {
  const assets = await db
    .select({
      id: libraryBookAssets.id,
      fileBucket: libraryBookAssets.fileBucket,
      fileKey: libraryBookAssets.fileKey,
    })
    .from(libraryBookAssets)
    .where(and(eq(libraryBookAssets.bookId, bookId), eq(libraryBookAssets.assetType, "file")));

  const supabase = createSupabaseAdminClient();

  for (const a of assets) {
    if (!a.fileBucket || !a.fileKey) continue;
    const parts = a.fileKey.split("/");
    const dir = parts.slice(0, -1).join("/");
    const name = parts[parts.length - 1] ?? "";

    let listData: { name: string }[] | null = null;
    let listError: unknown = null;
    try {
      const res = await supabase.storage.from(a.fileBucket).list(dir, { limit: 100, search: name });
      listData = res.data;
      listError = res.error;
    } catch (err) {
      listError = err;
    }

    if (listError) {
      const { status, message } = getStorageErrorMeta(listError);
      console.error("[library] approve check storage list failed", { status, message, bucket: a.fileBucket, dir, bookId });
      throw new HttpError(500, "INTERNAL_ERROR", "校验文件存在性失败", { status, message });
    }

    const exists = (listData ?? []).some((o) => o.name === name);
    if (!exists) {
      throw conflict("存在未成功上传或已被移除的文件资产，禁止审核通过；请先要求作者重新上传并再次提交审核");
    }
  }
}

export async function listConsoleLibraryBooks(params: {
  page: number;
  pageSize: number;
  status?: BookStatus;
  q?: string;
}) {
  const where = [isNull(libraryBooks.deletedAt)];

  if (params.status) where.push(eq(libraryBooks.status, params.status));
  if (params.q && params.q.trim()) {
    const raw = params.q.trim();
    const digits = raw.replace(/[^0-9]/g, "");
    const pattern = `%${raw}%`;
    const isbnPattern = digits ? `%${digits}%` : pattern;
    where.push(
      or(
        sql`${libraryBooks.title} ilike ${pattern}`,
        sql`${libraryBooks.author} ilike ${pattern}`,
        sql`${libraryBooks.keywords} ilike ${pattern}`,
        sql`${libraryBooks.isbn13} ilike ${isbnPattern}`,
      )!,
    );
  }

  const offset = (params.page - 1) * params.pageSize;

  const countRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(libraryBooks)
    .where(and(...where));

  const rows = await db
    .select({
      id: libraryBooks.id,
      isbn13: libraryBooks.isbn13,
      title: libraryBooks.title,
      author: libraryBooks.author,
      summary: libraryBooks.summary,
      keywords: libraryBooks.keywords,
      status: libraryBooks.status,
      submittedAt: libraryBooks.submittedAt,
      reviewedBy: libraryBooks.reviewedBy,
      reviewedAt: libraryBooks.reviewedAt,
      reviewComment: libraryBooks.reviewComment,
      publishedAt: libraryBooks.publishedAt,
      unpublishedAt: libraryBooks.unpublishedAt,
      downloadCount: libraryBooks.downloadCount,
      lastDownloadAt: libraryBooks.lastDownloadAt,
      createdBy: libraryBooks.createdBy,
      authorName: profiles.name,
      authorEmail: authUsers.email,
      createdAt: libraryBooks.createdAt,
      updatedBy: libraryBooks.updatedBy,
      updatedAt: libraryBooks.updatedAt,
      deletedAt: libraryBooks.deletedAt,
    })
    .from(libraryBooks)
    .innerJoin(profiles, eq(profiles.id, libraryBooks.createdBy))
    .leftJoin(authUsers, eq(authUsers.id, libraryBooks.createdBy))
    .where(and(...where))
    .orderBy(desc(libraryBooks.createdAt))
    .limit(params.pageSize)
    .offset(offset);

  const bookIds = rows.map((r) => r.id);
  const assetsByBookId = await getAssetsForBooks(bookIds);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total: Number(countRow[0]?.total ?? 0),
    items: rows.map((r) => {
      const row = r as unknown as BookRow;
      const meta = buildAssetMeta(assetsByBookId.get(row.id) ?? []);
      return buildBookListItem({ row, assetMeta: meta, isFavorite: false });
    }),
  };
}

export async function getConsoleLibraryBookDetail(params: { bookId: string }) {
  requireUuid(params.bookId, "id");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();

  const assets = await listBookAssets(row.id);

  return {
    id: row.id,
    isbn13: row.isbn13,
    title: row.title,
    author: row.author,
    summary: row.summary,
    keywords: row.keywords,
    status: row.status,
    assets: assets.map(toAssetDto),
    isFavorite: false,
    review: { reviewedBy: row.reviewedBy, reviewedAt: row.reviewedAt, comment: row.reviewComment },
    submittedAt: row.submittedAt,
    publishedAt: row.publishedAt,
    unpublishedAt: row.unpublishedAt,
    downloadCount: row.downloadCount,
    lastDownloadAt: row.lastDownloadAt,
    createdBy: row.createdBy,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    createdAt: row.createdAt,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

export async function approveConsoleLibraryBook(params: { bookId: string; comment?: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  requireUuid(params.bookId, "id");

  const before = await getBookAuditSnapshot(params.bookId);
  if (!before || before.deletedAt) throw notFound();
  if (before.status !== "pending") throw conflict("仅待审核图书允许通过");

  try {
    const assetCount = (before.assets ?? []).length;
    if (assetCount <= 0) throw conflict("该图书暂无资产，禁止审核通过");

    await assertAllFileAssetsExist(params.bookId);

    await db
      .update(libraryBooks)
      .set({
        status: "published",
        reviewedBy: params.actor.userId,
        reviewedAt: sql`now()`,
        reviewComment: params.comment ?? null,
        publishedAt: sql`now()`,
        unpublishedAt: null,
        updatedBy: params.actor.userId,
      })
      .where(eq(libraryBooks.id, params.bookId));

    const after = await getBookAuditSnapshot(params.bookId);

    await writeAuditLog({
      actor: params.actor,
      action: "library.book.review.approve",
      targetType: "library_book",
      targetId: params.bookId,
      success: true,
      reason: params.reason,
      diff: { before, after, comment: params.comment ?? null },
      request: params.request,
    });

    return getConsoleLibraryBookDetail({ bookId: params.bookId });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "library.book.review.approve",
      targetType: "library_book",
      targetId: params.bookId,
      success: false,
      errorCode: toErrorCode(err),
      reason: params.reason,
      diff: { before, comment: params.comment ?? null },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function rejectConsoleLibraryBook(params: { bookId: string; comment: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  requireUuid(params.bookId, "id");

  const before = await getBookAuditSnapshot(params.bookId);
  if (!before || before.deletedAt) throw notFound();
  if (before.status !== "pending") throw conflict("仅待审核图书允许驳回");

  try {
    await db
      .update(libraryBooks)
      .set({
        status: "rejected",
        reviewedBy: params.actor.userId,
        reviewedAt: sql`now()`,
        reviewComment: params.comment,
        updatedBy: params.actor.userId,
      })
      .where(eq(libraryBooks.id, params.bookId));

    const after = await getBookAuditSnapshot(params.bookId);

    await writeAuditLog({
      actor: params.actor,
      action: "library.book.review.reject",
      targetType: "library_book",
      targetId: params.bookId,
      success: true,
      reason: params.reason,
      diff: { before, after, comment: params.comment },
      request: params.request,
    });

    return getConsoleLibraryBookDetail({ bookId: params.bookId });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "library.book.review.reject",
      targetType: "library_book",
      targetId: params.bookId,
      success: false,
      errorCode: toErrorCode(err),
      reason: params.reason,
      diff: { before, comment: params.comment },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function offlineConsoleLibraryBook(params: { bookId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  requireUuid(params.bookId, "id");

  const before = await getBookAuditSnapshot(params.bookId);
  if (!before || before.deletedAt) throw notFound();
  if (before.status !== "published") throw conflict("仅已发布图书允许下架");

  try {
    await db
      .update(libraryBooks)
      .set({ status: "unpublished", unpublishedAt: sql`now()`, updatedBy: params.actor.userId })
      .where(eq(libraryBooks.id, params.bookId));

    const after = await getBookAuditSnapshot(params.bookId);

    await writeAuditLog({
      actor: params.actor,
      action: "library.book.offline",
      targetType: "library_book",
      targetId: params.bookId,
      success: true,
      reason: params.reason,
      diff: { before, after },
      request: params.request,
    });

    return getConsoleLibraryBookDetail({ bookId: params.bookId });
  } catch (err) {
    await writeAuditLog({
      actor: params.actor,
      action: "library.book.offline",
      targetType: "library_book",
      targetId: params.bookId,
      success: false,
      errorCode: toErrorCode(err),
      reason: params.reason,
      diff: { before },
      request: params.request,
    }).catch(() => {});
    throw err;
  }
}

export async function downloadConsoleLibraryBook(params: { bookId: string; assetId?: string }) {
  requireUuid(params.bookId, "id");
  if (params.assetId) requireUuid(params.assetId, "assetId");

  const row = await getBookRow(params.bookId);
  if (!row || row.deletedAt) throw notFound();

  const assets = await listBookAssets(row.id);
  const defaultAssetId = pickDefaultDownloadAssetId(assets);
  const selectedAssetId = params.assetId ?? defaultAssetId;
  if (!selectedAssetId) throw conflict("该图书暂无可下载资产");

  const asset = assets.find((a) => a.id === selectedAssetId);
  if (!asset) throw notFound("资产不存在或不可见");

  if (asset.assetType === "file") {
    if (!asset.fileBucket || !asset.fileKey) throw conflict("文件信息不完整");
    const signed = await storageAdapter.createSignedDownloadUrl({
      bucket: asset.fileBucket,
      key: asset.fileKey,
      expiresIn: SIGNED_URL_EXPIRES_IN,
      download: asset.fileName ?? true,
    });
    return { redirectUrl: signed.signedUrl };
  }

  if (!asset.linkUrlNormalized) throw conflict("外链信息不完整");
  return { redirectUrl: asset.linkUrlNormalized };
}

export async function hardDeleteConsoleLibraryBook(params: { bookId: string; actor: AuditActor; request: RequestContext; reason?: string }) {
  requireUuid(params.bookId, "id");

  const before = await getBookAuditSnapshot(params.bookId);
  if (!before) throw notFound();

  const fileAssets = (before.assets ?? []).filter((a) => a.assetType === "file");
  const fileKeysByBucket = new Map<string, string[]>();
  for (const a of fileAssets) {
    if (!a.fileBucket || !a.fileKey) continue;
    const list = fileKeysByBucket.get(a.fileBucket) ?? [];
    list.push(a.fileKey);
    fileKeysByBucket.set(a.fileBucket, list);
  }

  for (const [bucket, keys] of fileKeysByBucket.entries()) {
    await storageAdapter.remove({ bucket, keys }).catch(() => {});
  }

  await db.delete(libraryBooks).where(eq(libraryBooks.id, params.bookId));

  await writeAuditLog({
    actor: params.actor,
    action: "library.book.delete.hard",
    targetType: "library_book",
    targetId: params.bookId,
    success: true,
    reason: params.reason,
    diff: { before },
    request: params.request,
  });

  return { ok: true as const };
}
