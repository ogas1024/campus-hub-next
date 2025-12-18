import { apiDeleteJson, apiGetJson, apiPostJson, apiPutJson } from "@/lib/api/http";

export type UserStatus = "pending_email_verification" | "pending_approval" | "active" | "disabled" | "banned";

export type ConsoleUserListItem = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
  studentId: string;
  status: UserStatus;
  roleIds: string[];
  departmentIds: string[];
  positionIds: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type ConsoleUserListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: ConsoleUserListItem[];
};

export type ConsoleUserDetailResponse = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  auth: {
    createdAt: string;
    lastSignInAt: string | null;
    bannedUntil: string | null;
    deletedAt: string | null;
  };
  profile: {
    name: string;
    username: string | null;
    studentId: string;
    avatarUrl: string | null;
    status: UserStatus;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
  };
  roles: Array<{ id: string; code: string; name: string }>;
  departments: Array<{ id: string; name: string; parentId: string | null }>;
  positions: Array<{ id: string; name: string }>;
};

export function fetchConsoleUsers(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: UserStatus;
  roleId?: string;
  departmentId?: string;
  positionId?: string;
  sortBy?: "createdAt" | "updatedAt" | "lastLoginAt";
  sortOrder?: "asc" | "desc";
}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.roleId) sp.set("roleId", params.roleId);
  if (params.departmentId) sp.set("departmentId", params.departmentId);
  if (params.positionId) sp.set("positionId", params.positionId);
  if (params.sortBy) sp.set("sortBy", params.sortBy);
  if (params.sortOrder) sp.set("sortOrder", params.sortOrder);
  const qs = sp.toString();
  return apiGetJson<ConsoleUserListResponse>(qs ? `/api/console/users?${qs}` : "/api/console/users");
}

export function fetchConsoleUserDetail(userId: string) {
  return apiGetJson<ConsoleUserDetailResponse>(`/api/console/users/${userId}`);
}

export function createConsoleUser(body: {
  email: string;
  password?: string;
  emailConfirm?: boolean;
  name: string;
  studentId: string;
  roleIds?: string[];
  departmentIds?: string[];
  positionIds?: string[];
}) {
  return apiPostJson<ConsoleUserDetailResponse>("/api/console/users", body);
}

export function inviteConsoleUser(body: {
  email: string;
  redirectTo?: string;
  name: string;
  studentId: string;
  roleIds?: string[];
  departmentIds?: string[];
  positionIds?: string[];
}) {
  return apiPostJson<{ userId: string }>("/api/console/users/invite", body);
}

export function approveUser(userId: string, body?: { reason?: string }) {
  return apiPostJson<{ ok: true }>(`/api/console/users/${userId}/approve`, body ?? {});
}

export function rejectUser(userId: string, body?: { reason?: string }) {
  return apiPostJson<{ ok: true }>(`/api/console/users/${userId}/reject`, body ?? {});
}

export function disableUser(userId: string, body?: { reason?: string }) {
  return apiPostJson<{ ok: true }>(`/api/console/users/${userId}/disable`, body ?? {});
}

export function enableUser(userId: string, body?: { reason?: string }) {
  return apiPostJson<{ ok: true }>(`/api/console/users/${userId}/enable`, body ?? {});
}

export function banUser(userId: string, body: { duration: string; reason?: string }) {
  return apiPostJson<{ ok: true }>(`/api/console/users/${userId}/ban`, body);
}

export function unbanUser(userId: string, body?: { reason?: string }) {
  return apiPostJson<{ ok: true }>(`/api/console/users/${userId}/unban`, body ?? {});
}

export function deleteUser(userId: string, params?: { reason?: string }) {
  const sp = new URLSearchParams({ soft: "true" });
  if (params?.reason) sp.set("reason", params.reason);
  return apiDeleteJson<{ ok: true }>(`/api/console/users/${userId}?${sp.toString()}`);
}

export function setUserRoles(userId: string, body: { roleIds: string[]; reason?: string }) {
  return apiPutJson<{ ok: true }>(`/api/console/users/${userId}/roles`, body);
}

export function setUserDepartments(userId: string, body: { departmentIds: string[]; reason?: string }) {
  return apiPutJson<{ ok: true }>(`/api/console/users/${userId}/departments`, body);
}

export function setUserPositions(userId: string, body: { positionIds: string[]; reason?: string }) {
  return apiPutJson<{ ok: true }>(`/api/console/users/${userId}/positions`, body);
}

