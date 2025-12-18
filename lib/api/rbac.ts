import { apiDeleteJson, apiGetJson, apiPatchJson, apiPostJson, apiPutJson } from "@/lib/api/http";

export type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Permission = {
  id: string;
  code: string;
  description: string | null;
  createdAt: string;
};

export function fetchRoles() {
  return apiGetJson<{ items: Role[] }>("/api/console/roles");
}

export function createRole(body: { code: string; name: string; description?: string; reason?: string }) {
  return apiPostJson<{ id: string }>("/api/console/roles", body);
}

export function updateRole(id: string, body: { name?: string; description?: string | null; reason?: string }) {
  return apiPatchJson<{ ok: true }>(`/api/console/roles/${id}`, body);
}

export function deleteRole(id: string, params?: { reason?: string }) {
  const sp = new URLSearchParams();
  if (params?.reason) sp.set("reason", params.reason);
  const qs = sp.toString();
  return apiDeleteJson<{ ok: true }>(qs ? `/api/console/roles/${id}?${qs}` : `/api/console/roles/${id}`);
}

export function fetchPermissions() {
  return apiGetJson<{ items: Permission[] }>("/api/console/permissions");
}

export function setRolePermissions(roleId: string, body: { permissionCodes: string[]; reason?: string }) {
  return apiPutJson<{ ok: true }>(`/api/console/roles/${roleId}/permissions`, body);
}

export function fetchRolePermissionCodes(roleId: string) {
  return apiGetJson<{ roleId: string; permissionCodes: string[] }>(`/api/console/roles/${roleId}/permissions`);
}
