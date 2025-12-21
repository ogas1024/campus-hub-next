import { apiDeleteJson, apiPostJson } from "@/lib/api/http";

import type { LibraryBookDetail } from "@/lib/api/library";

export function approveConsoleLibraryBook(id: string, body?: { comment?: string; reason?: string }) {
  return apiPostJson<LibraryBookDetail>(`/api/console/library/books/${encodeURIComponent(id)}/approve`, body ?? {});
}

export function rejectConsoleLibraryBook(id: string, body: { comment: string; reason?: string }) {
  return apiPostJson<LibraryBookDetail>(`/api/console/library/books/${encodeURIComponent(id)}/reject`, body);
}

export function offlineConsoleLibraryBook(id: string, body?: { reason?: string }) {
  return apiPostJson<LibraryBookDetail>(`/api/console/library/books/${encodeURIComponent(id)}/offline`, body ?? {});
}

export function hardDeleteConsoleLibraryBook(id: string, params?: { reason?: string }) {
  const sp = new URLSearchParams();
  if (params?.reason) sp.set("reason", params.reason);
  const qs = sp.toString();
  return apiDeleteJson<{ ok: true }>(qs ? `/api/console/library/books/${encodeURIComponent(id)}?${qs}` : `/api/console/library/books/${encodeURIComponent(id)}`);
}
