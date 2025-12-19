import { apiGetJson, apiPatchJson, apiPostJson } from "@/lib/api/http";

export type ReservationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type Paginated<T> = { page: number; pageSize: number; total: number; items: T[] };

export type MyReservationListItem = {
  id: string;
  status: ReservationStatus;
  building: { id: string; name: string };
  room: { id: string; name: string; floorNo: number };
  purpose: string;
  startAt: string;
  endAt: string;
  participantCount: number;
  rejectReason: string | null;
  createdAt: string;
};

export type MyReservationDetail = {
  id: string;
  status: ReservationStatus;
  building: { id: string; name: string };
  room: { id: string; name: string; floorNo: number };
  purpose: string;
  startAt: string;
  endAt: string;
  rejectReason: string | null;
  participants: Array<{ id: string; name: string; studentId: string; isApplicant: boolean }>;
  participantUserIds: string[];
  applicant: { id: string; name: string; studentId: string } | null;
  createdAt: string;
};

export function fetchMyReservations(params: { page?: number; pageSize?: number; status?: ReservationStatus }) {
  const sp = new URLSearchParams();
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.status) sp.set("status", params.status);
  const qs = sp.toString();
  return apiGetJson<Paginated<MyReservationListItem>>(qs ? `/api/me/reservations?${qs}` : "/api/me/reservations");
}

export function createMyReservation(body: {
  roomId: string;
  startAt: string;
  endAt: string;
  purpose: string;
  participantUserIds: string[];
}) {
  return apiPostJson<{ id: string; status: ReservationStatus }>("/api/me/reservations", body);
}

export function fetchMyReservationDetail(id: string) {
  return apiGetJson<MyReservationDetail>(`/api/me/reservations/${encodeURIComponent(id)}`);
}

export function updateMyReservation(
  id: string,
  body: {
    startAt: string;
    endAt: string;
    purpose: string;
    participantUserIds: string[];
  },
) {
  return apiPatchJson<{ ok: true }>(`/api/me/reservations/${encodeURIComponent(id)}`, body);
}

export function cancelMyReservation(id: string, body?: { reason?: string }) {
  return apiPostJson<{ ok: true }>(`/api/me/reservations/${encodeURIComponent(id)}/cancel`, body ?? {});
}

