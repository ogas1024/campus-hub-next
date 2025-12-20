import { apiDeleteJson, apiGetJson, apiPostForm, apiPostJson } from "@/lib/api/http";

export type MaterialStatus = "draft" | "published" | "closed";
export type MaterialSubmissionStatus = "pending" | "complete" | "need_more" | "approved" | "rejected";

export type PortalMaterialListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    title: string;
    status: MaterialStatus;
    noticeId: string | null;
    dueAt: string | null;
    canSubmit: boolean;
    updatedAt: string;
  }>;
};

export type PortalMaterialDetail = {
  id: string;
  title: string;
  descriptionMd: string;
  status: MaterialStatus;
  maxFilesPerSubmission: number;
  dueAt: string | null;
  canSubmit: boolean;
  notice: null | { id: string; title: string };
  items: Array<{
    id: string;
    title: string;
    description: string | null;
    required: boolean;
    sort: number;
    template: null | { fileName: string; contentType: string; size: number; downloadUrl: string | null };
  }>;
  mySubmission: null | {
    id: string;
    submittedAt: string | null;
    withdrawnAt: string | null;
    status: MaterialSubmissionStatus;
    studentMessage: string | null;
    missingRequired: boolean;
    files: Array<{ id: string; itemId: string; fileName: string; contentType: string; size: number; downloadUrl: string | null }>;
  };
};

export function fetchPortalMaterials(params: { page: number; pageSize: number; q?: string }) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  return apiGetJson<PortalMaterialListResponse>(`/api/materials?${sp.toString()}`);
}

export function fetchPortalMaterialDetail(materialId: string) {
  return apiGetJson<PortalMaterialDetail>(`/api/materials/${materialId}`);
}

export function uploadMyMaterialFile(materialId: string, itemId: string, file: File) {
  const formData = new FormData();
  formData.append("itemId", itemId);
  formData.append("file", file);
  return apiPostForm<{ id: string; itemId: string; fileName: string; contentType: string; size: number }>(`/api/materials/${materialId}/files`, formData);
}

export function deleteMyMaterialFile(materialId: string, fileId: string) {
  return apiDeleteJson<{ ok: true }>(`/api/materials/${materialId}/files/${fileId}`);
}

export function submitMyMaterial(materialId: string) {
  return apiPostJson<{ ok: true; submissionId: string; submittedAt: string }>(`/api/materials/${materialId}/submit`);
}

export function withdrawMyMaterial(materialId: string) {
  return apiPostJson<{ ok: true }>(`/api/materials/${materialId}/withdraw`);
}
