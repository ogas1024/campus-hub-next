import { apiDeleteJson, apiGetJson, apiPostForm, apiPostJson, apiPutJson } from "@/lib/api/http";
import type { ScopeInput, ScopeOptionsResponse } from "@/lib/api/visibility-scope";

export type MaterialStatus = "draft" | "published" | "closed";
export type MaterialSubmissionStatus = "pending" | "complete" | "need_more" | "approved" | "rejected";

export type MaterialScopeOptionsResponse = ScopeOptionsResponse;

export type MaterialScopeInput = ScopeInput;

export type MaterialItemInput = { id: string; title: string; description?: string | null; required: boolean; sort: number };

export type ConsoleMaterialListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    title: string;
    status: MaterialStatus;
    noticeId: string | null;
    visibleAll: boolean;
    maxFilesPerSubmission: number;
    dueAt: string | null;
    createdBy: string;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type ConsoleMaterialDetail = {
  id: string;
  title: string;
  descriptionMd: string;
  status: MaterialStatus;
  noticeId: string | null;
  notice: null | { id: string; title: string };
  visibleAll: boolean;
  scopes: MaterialScopeInput[];
  maxFilesPerSubmission: number;
  dueAt: string | null;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    title: string;
    description: string | null;
    required: boolean;
    sort: number;
    template: null | { fileKey: string; fileName: string; contentType: string; size: number };
  }>;
};

export type ConsoleMaterialSubmissionsResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    userId: string;
    name: string;
    studentId: string;
    departments: string[];
    submittedAt: string | null;
    status: MaterialSubmissionStatus;
    assigneeUserId: string | null;
    studentMessage: string | null;
    missingRequired: boolean;
  }>;
};

export function fetchMaterialScopeOptions() {
  return apiGetJson<MaterialScopeOptionsResponse>("/api/console/materials/scope-options");
}

export function fetchConsoleMaterials(params: {
  page: number;
  pageSize: number;
  q?: string;
  status?: MaterialStatus;
  mine?: boolean;
  archived?: boolean;
}) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.mine) sp.set("mine", "true");
  if (params.archived) sp.set("archived", "true");
  return apiGetJson<ConsoleMaterialListResponse>(`/api/console/materials?${sp.toString()}`);
}

export function createConsoleMaterial(body: {
  title: string;
  descriptionMd?: string;
  noticeId?: string | null;
  visibleAll: boolean;
  scopes: MaterialScopeInput[];
  maxFilesPerSubmission: number;
  dueAt?: string | null;
  items: MaterialItemInput[];
}) {
  return apiPostJson<{ id: string }>("/api/console/materials", body);
}

export function fetchConsoleMaterialDetail(materialId: string) {
  return apiGetJson<ConsoleMaterialDetail>(`/api/console/materials/${materialId}`);
}

export function updateConsoleMaterialDraft(materialId: string, body: {
  title: string;
  descriptionMd?: string;
  noticeId?: string | null;
  visibleAll: boolean;
  scopes: MaterialScopeInput[];
  maxFilesPerSubmission: number;
  dueAt?: string | null;
  items: MaterialItemInput[];
}) {
  return apiPutJson<ConsoleMaterialDetail>(`/api/console/materials/${materialId}`, body);
}

export function publishConsoleMaterial(materialId: string) {
  return apiPostJson<ConsoleMaterialDetail>(`/api/console/materials/${materialId}/publish`);
}

export function closeConsoleMaterial(materialId: string) {
  return apiPostJson<ConsoleMaterialDetail>(`/api/console/materials/${materialId}/close`);
}

export function archiveConsoleMaterial(materialId: string) {
  return apiPostJson<ConsoleMaterialDetail>(`/api/console/materials/${materialId}/archive`);
}

export function deleteConsoleMaterial(materialId: string, params?: { reason?: string }) {
  const sp = new URLSearchParams();
  const reason = params?.reason?.trim() ?? "";
  if (reason) sp.set("reason", reason);
  const query = sp.toString();
  return apiDeleteJson<{ ok: true }>(query ? `/api/console/materials/${materialId}?${query}` : `/api/console/materials/${materialId}`);
}

export function uploadMaterialItemTemplate(materialId: string, itemId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiPostForm<ConsoleMaterialDetail>(`/api/console/materials/${materialId}/items/${itemId}/template`, formData);
}

export function updateConsoleMaterialDueAt(materialId: string, dueAt: string) {
  return apiPostJson<ConsoleMaterialDetail>(`/api/console/materials/${materialId}/due`, { dueAt });
}

export function fetchConsoleMaterialSubmissions(materialId: string, params: {
  page: number;
  pageSize: number;
  q?: string;
  status?: MaterialSubmissionStatus;
  missingRequired?: boolean;
  from?: string;
  to?: string;
  departmentId?: string;
}) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (typeof params.missingRequired === "boolean") sp.set("missingRequired", params.missingRequired ? "true" : "false");
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.departmentId) sp.set("departmentId", params.departmentId);
  return apiGetJson<ConsoleMaterialSubmissionsResponse>(`/api/console/materials/${materialId}/submissions?${sp.toString()}`);
}

export function batchProcessMaterialSubmissions(materialId: string, body: {
  submissionIds: string[];
  action: "assignToMe" | "unassign" | "setStatus";
  status?: MaterialSubmissionStatus;
  studentMessage?: string | null;
  staffNote?: string | null;
}) {
  return apiPostJson<{ ok: true }>(`/api/console/materials/${materialId}/submissions/batch`, body);
}

export function buildConsoleMaterialExportUrl(materialId: string, params?: {
  q?: string;
  status?: MaterialSubmissionStatus;
  missingRequired?: boolean;
  from?: string;
  to?: string;
  departmentId?: string;
  includeUnsubmitted?: boolean;
}) {
  const sp = new URLSearchParams();
  if (params?.q && params.q.trim()) sp.set("q", params.q.trim());
  if (params?.status) sp.set("status", params.status);
  if (typeof params?.missingRequired === "boolean") sp.set("missingRequired", params.missingRequired ? "true" : "false");
  if (params?.from) sp.set("from", params.from);
  if (params?.to) sp.set("to", params.to);
  if (params?.departmentId) sp.set("departmentId", params.departmentId);
  if (params?.includeUnsubmitted) sp.set("includeUnsubmitted", "true");
  const query = sp.toString();
  return query ? `/api/console/materials/${materialId}/export?${query}` : `/api/console/materials/${materialId}/export`;
}
