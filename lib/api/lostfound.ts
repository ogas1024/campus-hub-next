import { apiGetJson } from "@/lib/api/http";

export type LostfoundType = "lost" | "found";
export type LostfoundStatus = "pending" | "published" | "rejected" | "offline";

export type SignedImage = { bucket: string; key: string; signedUrl: string };

export type PortalLostfoundListItem = {
  id: string;
  type: LostfoundType;
  title: string;
  location: string | null;
  occurredAt: string | null;
  publishedAt: string | null;
  solvedAt: string | null;
  coverImage: SignedImage | null;
};

export type Paginated<T> = { page: number; pageSize: number; total: number; items: T[] };

export type PortalLostfoundListResponse = Paginated<PortalLostfoundListItem>;

export type PortalLostfoundDetail = {
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
  images: SignedImage[];
  createdAt: string;
  updatedAt: string;
};

export function fetchPortalLostfoundList(params: {
  page?: number;
  pageSize?: number;
  type?: LostfoundType;
  q?: string;
  solved?: boolean;
  from?: string;
  to?: string;
}) {
  const sp = new URLSearchParams();
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  if (params.type) sp.set("type", params.type);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.solved) sp.set("solved", "true");
  if (params.from && params.from.trim()) sp.set("from", params.from.trim());
  if (params.to && params.to.trim()) sp.set("to", params.to.trim());
  const qs = sp.toString();
  return apiGetJson<PortalLostfoundListResponse>(qs ? `/api/lostfound?${qs}` : "/api/lostfound");
}

export function fetchPortalLostfoundDetail(id: string) {
  return apiGetJson<PortalLostfoundDetail>(`/api/lostfound/${encodeURIComponent(id)}`);
}

