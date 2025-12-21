import { apiDeleteJson, apiGetJson, apiPostForm, apiPostJson, apiPutJson } from "@/lib/api/http";
import type { LostfoundStatus, LostfoundType, Paginated, SignedImage } from "@/lib/api/lostfound";

export type MyLostfoundListItem = {
  id: string;
  type: LostfoundType;
  title: string;
  status: LostfoundStatus;
  publishedAt: string | null;
  solvedAt: string | null;
  rejectReason: string | null;
  offlineReason: string | null;
  createdAt: string;
};

export type MyLostfoundListResponse = Paginated<MyLostfoundListItem>;

export type MyLostfoundDetail = {
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
  offlineReason: string | null;
  images: SignedImage[];
  createdAt: string;
  updatedAt: string;
};

export type CreateMyLostfoundBody = {
  type: LostfoundType;
  title: string;
  content: string;
  location?: string | null;
  occurredAt?: string | null;
  contactInfo?: string | null;
  imageKeys?: string[];
};

export type UpdateMyLostfoundBody = Partial<CreateMyLostfoundBody>;

export function fetchMyLostfoundList(params: {
  page?: number;
  pageSize?: number;
  status?: LostfoundStatus;
  q?: string;
}) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return apiGetJson<MyLostfoundListResponse>(qs ? `/api/me/lostfound?${qs}` : "/api/me/lostfound");
}

export function createMyLostfound(body: CreateMyLostfoundBody) {
  return apiPostJson<{ id: string }>("/api/me/lostfound", body);
}

export function fetchMyLostfoundDetail(id: string) {
  return apiGetJson<MyLostfoundDetail>(`/api/me/lostfound/${encodeURIComponent(id)}`);
}

export function updateMyLostfound(id: string, body: UpdateMyLostfoundBody) {
  return apiPutJson<{ ok: true }>(`/api/me/lostfound/${encodeURIComponent(id)}`, body);
}

export function deleteMyLostfound(id: string) {
  return apiDeleteJson<{ ok: true }>(`/api/me/lostfound/${encodeURIComponent(id)}`);
}

export function solveMyLostfound(id: string) {
  return apiPostJson<{ ok: true }>(`/api/me/lostfound/${encodeURIComponent(id)}/solve`);
}

export function uploadMyLostfoundImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiPostForm<SignedImage>("/api/me/lostfound/images", form);
}

