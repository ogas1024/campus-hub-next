import { apiDeleteJson, apiGetJson, apiPostForm, apiPostJson, apiPutJson } from "@/lib/api/http";
import type { ScopeInput, ScopeOptionsResponse } from "@/lib/api/visibility-scope";

export type NoticeStatus = "draft" | "published" | "retracted";

export type { ScopeOption, ScopeType } from "@/lib/api/visibility-scope";

export type NoticeScopeOptionsResponse = ScopeOptionsResponse;

export type NoticeScopeInput = ScopeInput;

export type NoticeAttachmentInput = {
  fileKey: string;
  fileName: string;
  contentType: string;
  size: number;
  sort: number;
};

export type ConsoleNoticeDetail = {
  id: string;
  title: string;
  contentMd: string;
  status: NoticeStatus;
  pinned: boolean;
  visibleAll: boolean;
  expireAt: string | null;
  isExpired: boolean;
  createdBy: string;
  scopes: NoticeScopeInput[];
  attachments: { id: string; fileKey: string; fileName: string; contentType: string; size: number; sort: number }[];
};

export type ConsoleNoticeMaterialResponse = {
  perms: { canCreate: boolean; canRead: boolean; canProcess: boolean };
  linked: null | { id: string; title: string; status: "draft" | "published" | "closed"; dueAt: string | null; archivedAt: string | null };
};

export function fetchNoticeScopeOptions() {
  return apiGetJson<NoticeScopeOptionsResponse>("/api/console/notices/scope-options");
}

export function fetchConsoleNoticeDetail(noticeId: string) {
  return apiGetJson<ConsoleNoticeDetail>(`/api/console/notices/${noticeId}`);
}

export function fetchConsoleNoticeMaterial(noticeId: string) {
  return apiGetJson<ConsoleNoticeMaterialResponse>(`/api/console/notices/${noticeId}/material`);
}

export function createConsoleNotice(body: {
  title: string;
  contentMd: string;
  expireAt?: string;
  visibleAll: boolean;
  scopes: NoticeScopeInput[];
  attachments: NoticeAttachmentInput[];
}) {
  return apiPostJson<ConsoleNoticeDetail>("/api/console/notices", body);
}

export function updateConsoleNotice(
  noticeId: string,
  body: {
    title: string;
    contentMd: string;
    expireAt?: string;
    visibleAll: boolean;
    scopes: NoticeScopeInput[];
    attachments: NoticeAttachmentInput[];
  },
) {
  return apiPutJson<ConsoleNoticeDetail>(`/api/console/notices/${noticeId}`, body);
}

export function publishConsoleNotice(noticeId: string) {
  return apiPostJson<ConsoleNoticeDetail>(`/api/console/notices/${noticeId}/publish`);
}

export function retractConsoleNotice(noticeId: string) {
  return apiPostJson<ConsoleNoticeDetail>(`/api/console/notices/${noticeId}/retract`);
}

export function setConsoleNoticePinned(noticeId: string, pinned: boolean) {
  return apiPostJson<ConsoleNoticeDetail>(`/api/console/notices/${noticeId}/pin`, { pinned });
}

export function deleteConsoleNotice(noticeId: string) {
  return apiDeleteJson<{ ok: true }>(`/api/console/notices/${noticeId}`);
}

export function uploadConsoleNoticeAttachment(noticeId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiPostForm<{ id: string; fileKey: string; fileName: string; contentType: string; size: number }>(
    `/api/console/notices/${noticeId}/attachments`,
    formData,
  );
}

export type PortalNoticeDetail = {
  id: string;
  title: string;
  contentMd: string;
  status: NoticeStatus;
  pinned: boolean;
  isExpired: boolean;
  read: boolean;
  readCount: number;
  publishAt: string;
  expireAt: string | null;
  attachments: Array<{ id: string; fileName: string; contentType: string; size: number; downloadUrl: string | null }>;
};

export type PortalNoticeMaterialResponse =
  | null
  | {
      id: string;
      title: string;
      status: "draft" | "published" | "closed";
      dueAt: string | null;
      canSubmit: boolean;
      updatedAt: string;
    };

export function fetchPortalNoticeDetail(noticeId: string) {
  return apiGetJson<PortalNoticeDetail>(`/api/notices/${noticeId}`);
}

export function fetchPortalNoticeMaterial(noticeId: string) {
  return apiGetJson<PortalNoticeMaterialResponse>(`/api/notices/${noticeId}/material`);
}
