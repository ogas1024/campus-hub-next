import { apiDeleteJson, apiGetJson, apiPostJson } from "@/lib/api/http";
import type { LostfoundStatus, LostfoundType, Paginated, SignedImage } from "@/lib/api/lostfound";

export type ConsoleLostfoundListItem = {
  id: string;
  type: LostfoundType;
  title: string;
  status: LostfoundStatus;
  publishedAt: string | null;
  solvedAt: string | null;
  createdBy: { id: string; name: string; studentId: string };
  createdAt: string;
};

export type ConsoleLostfoundListResponse = Paginated<ConsoleLostfoundListItem>;

export type ConsoleLostfoundDetail = {
  id: string;
  type: LostfoundType;
  title: string;
  content: string;
  location: string | null;
  occurredAt: string | null;
  contactInfo: string | null;
  status: LostfoundStatus;
  publishedAt: string | null;
  solvedAt: string | null;
  rejectReason: string | null;
  review: { reviewedBy: string | null; reviewedAt: string | null };
  offline: { offlinedBy: string | null; offlinedAt: string | null; reason: string | null };
  images: SignedImage[];
  createdBy: { id: string; name: string; studentId: string; email: string | null };
  createdAt: string;
  updatedAt: string;
};

export function fetchConsoleLostfoundList(params: {
  page?: number;
  pageSize?: number;
  status?: LostfoundStatus;
  type?: LostfoundType;
  q?: string;
  from?: string;
  to?: string;
}) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.type) sp.set("type", params.type);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.from && params.from.trim()) sp.set("from", params.from.trim());
  if (params.to && params.to.trim()) sp.set("to", params.to.trim());
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return apiGetJson<ConsoleLostfoundListResponse>(qs ? `/api/console/lostfound?${qs}` : "/api/console/lostfound");
}

export function fetchConsoleLostfoundDetail(id: string) {
  return apiGetJson<ConsoleLostfoundDetail>(`/api/console/lostfound/${encodeURIComponent(id)}`);
}

export function approveConsoleLostfound(id: string) {
  return apiPostJson<{ ok: true }>(`/api/console/lostfound/${encodeURIComponent(id)}/approve`);
}

export function rejectConsoleLostfound(id: string, body: { reason: string }) {
  return apiPostJson<{ ok: true }>(`/api/console/lostfound/${encodeURIComponent(id)}/reject`, body);
}

export function offlineConsoleLostfound(id: string, body: { reason: string }) {
  return apiPostJson<{ ok: true }>(`/api/console/lostfound/${encodeURIComponent(id)}/offline`, body);
}

export function restoreConsoleLostfound(id: string) {
  return apiPostJson<{ ok: true }>(`/api/console/lostfound/${encodeURIComponent(id)}/restore`);
}

export function deleteConsoleLostfound(id: string) {
  return apiDeleteJson<{ ok: true }>(`/api/console/lostfound/${encodeURIComponent(id)}`);
}

