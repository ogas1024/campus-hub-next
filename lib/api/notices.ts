import { apiDeleteJson, apiGetJson, apiPostForm, apiPostJson, apiPutJson } from "@/lib/api/http";

export type NoticeStatus = "draft" | "published" | "retracted";

export type ScopeType = "role" | "department" | "position";
export type ScopeOption = { id: string; name: string; parentId?: string | null; code?: string };

export type NoticeScopeOptionsResponse = {
  roles: ScopeOption[];
  departments: ScopeOption[];
  positions: ScopeOption[];
};

export type NoticeScopeInput = { scopeType: ScopeType; refId: string };

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

export function fetchNoticeScopeOptions() {
  return apiGetJson<NoticeScopeOptionsResponse>("/api/console/notices/scope-options");
}

export function fetchConsoleNoticeDetail(noticeId: string) {
  return apiGetJson<ConsoleNoticeDetail>(`/api/console/notices/${noticeId}`);
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

