import { apiGetJson } from "@/lib/api/http";

export type AuditLogListItem = {
  id: string;
  occurredAt: string;
  actorUserId: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  success: boolean;
};

export type AuditLogListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: AuditLogListItem[];
};

export type AuditLogDetail = {
  id: string;
  occurredAt: string;
  actorUserId: string;
  actorEmail: string | null;
  actorRoles: unknown;
  action: string;
  targetType: string;
  targetId: string;
  success: boolean;
  errorCode: string | null;
  reason: string | null;
  diff: unknown;
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
};

export function fetchAuditLogs(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  actorUserId?: string;
  success?: boolean | null;
  from?: string;
  to?: string;
}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.q) sp.set("q", params.q);
  if (params.action) sp.set("action", params.action);
  if (params.targetType) sp.set("targetType", params.targetType);
  if (params.targetId) sp.set("targetId", params.targetId);
  if (params.actorUserId) sp.set("actorUserId", params.actorUserId);
  if (typeof params.success === "boolean") sp.set("success", params.success ? "true" : "false");
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const qs = sp.toString();
  return apiGetJson<AuditLogListResponse>(qs ? `/api/console/audit-logs?${qs}` : "/api/console/audit-logs");
}

export function fetchAuditLogDetail(id: string) {
  return apiGetJson<AuditLogDetail>(`/api/console/audit-logs/${id}`);
}

