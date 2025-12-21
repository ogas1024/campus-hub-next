import { apiDeleteJson, apiGetJson, apiPatchJson, apiPostJson } from "@/lib/api/http";

export type BookStatus = "draft" | "pending" | "published" | "rejected" | "unpublished";
export type AssetType = "file" | "link";
export type FileFormat = "pdf" | "epub" | "mobi" | "zip";

export type LibraryBookAsset = {
  id: string;
  assetType: AssetType;
  fileFormat: FileFormat | null;
  file: { bucket: string; key: string; fileName: string; size: number } | null;
  link: { url: string; normalizedUrl: string } | null;
  createdAt: string;
};

export type LibraryBookListItem = {
  id: string;
  isbn13: string;
  title: string;
  author: string;
  summary: string | null;
  keywords: string | null;
  status: BookStatus;
  downloadCount: number;
  assetFormats: FileFormat[];
  hasLinkAssets: boolean;
  isFavorite: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  unpublishedAt: string | null;
  createdBy: string;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LibraryBookDetail = {
  id: string;
  isbn13: string;
  title: string;
  author: string;
  summary: string | null;
  keywords: string | null;
  status: BookStatus;
  assets: LibraryBookAsset[];
  isFavorite: boolean;
  review: { reviewedBy: string | null; reviewedAt: string | null; comment: string | null };
  submittedAt: string | null;
  publishedAt: string | null;
  unpublishedAt: string | null;
  downloadCount: number;
  lastDownloadAt: string | null;
  createdBy: string;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
};

export type Paginated<T> = { page: number; pageSize: number; total: number; items: T[] };

export function fetchPortalLibraryBooks(params: {
  q?: string;
  format?: FileFormat;
  sortBy?: "publishedAt" | "downloadCount";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.format) sp.set("format", params.format);
  if (params.sortBy) sp.set("sortBy", params.sortBy);
  if (params.sortOrder) sp.set("sortOrder", params.sortOrder);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return apiGetJson<Paginated<LibraryBookListItem>>(qs ? `/api/library?${qs}` : "/api/library");
}

export function fetchPortalLibraryBookDetail(id: string) {
  return apiGetJson<LibraryBookDetail>(`/api/library/${encodeURIComponent(id)}`);
}

export function setLibraryBookFavorite(id: string, body: { favorite: boolean }) {
  return apiPostJson<{ ok: true; favorite: boolean }>(`/api/library/${encodeURIComponent(id)}/favorite`, body);
}

export function fetchLibraryBookDownloadLeaderboard(params?: { days?: 7 | 30 | 365 }) {
  const sp = new URLSearchParams();
  if (params?.days) sp.set("days", String(params.days));
  const qs = sp.toString();
  return apiGetJson<{ days: number; items: Array<{ book: LibraryBookListItem; windowDownloadCount: number }> }>(
    qs ? `/api/library/leaderboard/books?${qs}` : "/api/library/leaderboard/books",
  );
}

export function fetchLibraryContributorLeaderboard(params?: { days?: 7 | 30 | 365 }) {
  const sp = new URLSearchParams();
  if (params?.days) sp.set("days", String(params.days));
  const qs = sp.toString();
  return apiGetJson<{ days: number; items: Array<{ userId: string; name: string; publishedBookCount: number }> }>(
    qs ? `/api/library/leaderboard/users?${qs}` : "/api/library/leaderboard/users",
  );
}

export function fetchMyLibraryBooks(params: { q?: string; status?: BookStatus; page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return apiGetJson<Paginated<LibraryBookListItem>>(qs ? `/api/me/library/books?${qs}` : "/api/me/library/books");
}

export function createMyLibraryBookDraft(body: { isbn13: string; title: string; author: string; summary?: string | null; keywords?: string | null }) {
  return apiPostJson<LibraryBookDetail>("/api/me/library/books", body);
}

export function fetchMyLibraryBookDetail(id: string) {
  return apiGetJson<LibraryBookDetail>(`/api/me/library/books/${encodeURIComponent(id)}`);
}

export function updateMyLibraryBook(
  id: string,
  body: Partial<{ isbn13: string; title: string; author: string; summary: string | null; keywords: string | null }>,
) {
  return apiPatchJson<LibraryBookDetail>(`/api/me/library/books/${encodeURIComponent(id)}`, body);
}

export function deleteMyLibraryBook(id: string) {
  return apiDeleteJson<{ ok: true }>(`/api/me/library/books/${encodeURIComponent(id)}`);
}

export function submitMyLibraryBook(id: string) {
  return apiPostJson<LibraryBookDetail>(`/api/me/library/books/${encodeURIComponent(id)}/submit`);
}

export function unpublishMyLibraryBook(id: string) {
  return apiPostJson<LibraryBookDetail>(`/api/me/library/books/${encodeURIComponent(id)}/unpublish`);
}

export function fetchMyFavoriteLibraryBooks(params?: { page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params?.page && params.page > 1) sp.set("page", String(params.page));
  if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return apiGetJson<Paginated<LibraryBookListItem>>(qs ? `/api/me/library/favorites?${qs}` : "/api/me/library/favorites");
}

export function createMyLibraryBookUploadUrl(
  bookId: string,
  body: { format: FileFormat; fileName: string; size: number; contentType?: string },
) {
  return apiPostJson<{ assetId: string; bucket: string; key: string; token: string; uploadUrl: string }>(
    `/api/me/library/books/${encodeURIComponent(bookId)}/assets/upload-url`,
    body,
  );
}

export function addMyLibraryBookLinkAsset(bookId: string, body: { url: string }) {
  return apiPostJson<LibraryBookDetail>(`/api/me/library/books/${encodeURIComponent(bookId)}/assets/link`, body);
}

export function deleteMyLibraryBookAsset(bookId: string, assetId: string) {
  return apiDeleteJson<LibraryBookDetail>(`/api/me/library/books/${encodeURIComponent(bookId)}/assets/${encodeURIComponent(assetId)}`);
}

