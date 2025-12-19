import { apiDeleteJson, apiGetJson, apiPostJson, apiPutJson } from "@/lib/api/http";

export type Building = {
  id: string;
  name: string;
  enabled: boolean;
  sort: number;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Room = {
  id: string;
  buildingId: string;
  buildingName: string;
  floorNo: number;
  name: string;
  capacity: number | null;
  enabled: boolean;
  sort: number;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReservationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type ConsoleReservationListItem = {
  id: string;
  status: ReservationStatus;
  purpose: string;
  startAt: string;
  endAt: string;
  applicant: { id: string; name: string; studentId: string };
  building: { id: string; name: string };
  room: { id: string; name: string; floorNo: number };
  participantCount: number;
  review: { reviewedBy: string | null; reviewedAt: string | null; rejectReason: string | null };
  cancel: { cancelledBy: string | null; cancelledAt: string | null; reason: string | null };
  createdAt: string;
};

export type Paginated<T> = { page: number; pageSize: number; total: number; items: T[] };

export type FacilityConfig = { auditRequired: boolean; maxDurationHours: number };

export type FacilityBanItem = {
  id: string;
  user: { id: string; name: string; studentId: string };
  reason: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  active: boolean;
  createdBy: string;
  revokedBy: string | null;
  createdAt: string;
};

export function fetchConsoleFacilityBuildings() {
  return apiGetJson<Building[]>("/api/console/facilities/buildings");
}

export function createConsoleFacilityBuilding(body: { name: string; enabled?: boolean; sort?: number; remark?: string }) {
  return apiPostJson<{ id: string }>("/api/console/facilities/buildings", body);
}

export function updateConsoleFacilityBuilding(id: string, body: { name?: string; enabled?: boolean; sort?: number; remark?: string | null }) {
  return apiPutJson<{ ok: true }>(`/api/console/facilities/buildings/${encodeURIComponent(id)}`, body);
}

export function deleteConsoleFacilityBuilding(id: string, params?: { reason?: string }) {
  const sp = new URLSearchParams();
  if (params?.reason) sp.set("reason", params.reason);
  const qs = sp.toString();
  return apiDeleteJson<{ ok: true }>(qs ? `/api/console/facilities/buildings/${encodeURIComponent(id)}?${qs}` : `/api/console/facilities/buildings/${encodeURIComponent(id)}`);
}

export function fetchConsoleFacilityRooms(params?: { buildingId?: string; floorNo?: number }) {
  const sp = new URLSearchParams();
  if (params?.buildingId) sp.set("buildingId", params.buildingId);
  if (typeof params?.floorNo === "number") sp.set("floorNo", String(params.floorNo));
  const qs = sp.toString();
  return apiGetJson<Room[]>(qs ? `/api/console/facilities/rooms?${qs}` : "/api/console/facilities/rooms");
}

export function createConsoleFacilityRoom(body: {
  buildingId: string;
  floorNo: number;
  name: string;
  capacity?: number | null;
  enabled?: boolean;
  sort?: number;
  remark?: string;
}) {
  return apiPostJson<{ id: string }>("/api/console/facilities/rooms", body);
}

export function updateConsoleFacilityRoom(
  id: string,
  body: { floorNo?: number; name?: string; capacity?: number | null; enabled?: boolean; sort?: number; remark?: string | null },
) {
  return apiPutJson<{ ok: true }>(`/api/console/facilities/rooms/${encodeURIComponent(id)}`, body);
}

export function deleteConsoleFacilityRoom(id: string, params?: { reason?: string }) {
  const sp = new URLSearchParams();
  if (params?.reason) sp.set("reason", params.reason);
  const qs = sp.toString();
  return apiDeleteJson<{ ok: true }>(qs ? `/api/console/facilities/rooms/${encodeURIComponent(id)}?${qs}` : `/api/console/facilities/rooms/${encodeURIComponent(id)}`);
}

export function fetchConsoleFacilityReservations(params: {
  page?: number;
  pageSize?: number;
  status?: ReservationStatus;
  buildingId?: string;
  floorNo?: number;
  roomId?: string;
  q?: string;
  from?: string;
  to?: string;
}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.status) sp.set("status", params.status);
  if (params.buildingId) sp.set("buildingId", params.buildingId);
  if (typeof params.floorNo === "number") sp.set("floorNo", String(params.floorNo));
  if (params.roomId) sp.set("roomId", params.roomId);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const qs = sp.toString();
  return apiGetJson<Paginated<ConsoleReservationListItem>>(qs ? `/api/console/facilities/reservations?${qs}` : "/api/console/facilities/reservations");
}

export function approveConsoleFacilityReservation(id: string) {
  return apiPostJson<{ ok: true }>(`/api/console/facilities/reservations/${encodeURIComponent(id)}/approve`);
}

export function rejectConsoleFacilityReservation(id: string, body: { reason: string }) {
  return apiPostJson<{ ok: true }>(`/api/console/facilities/reservations/${encodeURIComponent(id)}/reject`, body);
}

export function fetchConsoleFacilityConfig() {
  return apiGetJson<FacilityConfig>("/api/console/facilities/config");
}

export function updateConsoleFacilityConfig(body: Partial<FacilityConfig> & { reason?: string }) {
  return apiPutJson<FacilityConfig>("/api/console/facilities/config", body);
}

export function fetchConsoleFacilityBans() {
  return apiGetJson<{ items: FacilityBanItem[] }>("/api/console/facilities/bans");
}

export function createConsoleFacilityBan(body: { userId: string; duration?: string; expiresAt?: string; reason?: string }) {
  return apiPostJson<{ ok: true }>("/api/console/facilities/bans", body);
}

export function revokeConsoleFacilityBan(id: string, body?: { reason?: string }) {
  return apiPostJson<{ ok: true }>(`/api/console/facilities/bans/${encodeURIComponent(id)}/revoke`, body ?? {});
}
