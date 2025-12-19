import { apiGetJson } from "@/lib/api/http";

export type Building = {
  id: string;
  name: string;
  enabled: boolean;
  sort: number;
  remark: string | null;
};

export type Room = {
  id: string;
  buildingId: string;
  floorNo: number;
  name: string;
  capacity: number | null;
  enabled: boolean;
  sort: number;
  remark: string | null;
};

export type ReservationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type TimelineItem = {
  id: string;
  roomId: string;
  status: "pending" | "approved";
  startAt: string;
  endAt: string;
};

export type FloorOverviewResponse = {
  buildingId: string;
  floorNo: number;
  window: { from: string; to: string };
  rooms: Room[];
  items: TimelineItem[];
};

export type RoomTimelineResponse = {
  room: Room & { buildingName: string };
  window: { from: string; to: string };
  items: TimelineItem[];
};

export type LeaderboardResponse = {
  days: 7 | 30;
  items: Array<{ id: string; label: string; totalSeconds: number }>;
};

export function fetchFacilityBuildings() {
  return apiGetJson<Building[]>("/api/facilities/buildings");
}

export function fetchFacilityFloors(buildingId: string) {
  return apiGetJson<{ buildingId: string; floors: number[] }>(`/api/facilities/floors?buildingId=${encodeURIComponent(buildingId)}`);
}

export function fetchFacilityFloorOverview(params: { buildingId: string; floorNo: number; from: string; days: 7 | 30 }) {
  const sp = new URLSearchParams();
  sp.set("buildingId", params.buildingId);
  sp.set("floorNo", String(params.floorNo));
  sp.set("from", params.from);
  sp.set("days", String(params.days));
  return apiGetJson<FloorOverviewResponse>(`/api/facilities/floors/overview?${sp.toString()}`);
}

export function fetchFacilityRoomTimeline(params: { roomId: string; from: string; days: 7 | 30 }) {
  const sp = new URLSearchParams();
  sp.set("from", params.from);
  sp.set("days", String(params.days));
  return apiGetJson<RoomTimelineResponse>(`/api/facilities/rooms/${encodeURIComponent(params.roomId)}/timeline?${sp.toString()}`);
}

export function fetchFacilityRoomLeaderboard(days: 7 | 30) {
  return apiGetJson<LeaderboardResponse>(`/api/facilities/leaderboard/rooms?days=${days}`);
}

export function fetchFacilityUserLeaderboard(days: 7 | 30) {
  return apiGetJson<LeaderboardResponse>(`/api/facilities/leaderboard/users?days=${days}`);
}

