import { apiDeleteJson, apiGetJson, apiPatchJson, apiPostJson } from "@/lib/api/http";

export type Department = {
  id: string;
  name: string;
  parentId: string | null;
  sort: number;
};

export type Position = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  enabled: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
};

export function fetchDepartments() {
  return apiGetJson<{ items: Department[] }>("/api/console/departments");
}

export function createDepartment(body: { name: string; parentId?: string | null; sort?: number; reason?: string }) {
  return apiPostJson<{ id: string }>("/api/console/departments", body);
}

export function updateDepartment(id: string, body: { name?: string; parentId?: string | null; sort?: number; reason?: string }) {
  return apiPatchJson<{ ok: true }>(`/api/console/departments/${id}`, body);
}

export function deleteDepartment(id: string, params?: { reason?: string }) {
  const sp = new URLSearchParams();
  if (params?.reason) sp.set("reason", params.reason);
  const qs = sp.toString();
  return apiDeleteJson<{ ok: true }>(qs ? `/api/console/departments/${id}?${qs}` : `/api/console/departments/${id}`);
}

export function fetchPositions() {
  return apiGetJson<{ items: Position[] }>("/api/console/positions");
}

export function createPosition(body: {
  code?: string;
  name: string;
  description?: string;
  enabled?: boolean;
  sort?: number;
  reason?: string;
}) {
  return apiPostJson<{ id: string }>("/api/console/positions", body);
}

export function updatePosition(
  id: string,
  body: { code?: string | null; name?: string; description?: string | null; enabled?: boolean; sort?: number; reason?: string },
) {
  return apiPatchJson<{ ok: true }>(`/api/console/positions/${id}`, body);
}

export function deletePosition(id: string, params?: { reason?: string }) {
  const sp = new URLSearchParams();
  if (params?.reason) sp.set("reason", params.reason);
  const qs = sp.toString();
  return apiDeleteJson<{ ok: true }>(qs ? `/api/console/positions/${id}?${qs}` : `/api/console/positions/${id}`);
}

