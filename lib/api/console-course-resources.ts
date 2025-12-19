import { apiDeleteJson, apiGetJson, apiPostJson, apiPutJson } from "@/lib/api/http";

export type Major = { id: string; name: string; enabled: boolean; sort: number; remark: string | null };
export type Course = { id: string; majorId: string; majorName?: string; name: string; code: string | null; enabled: boolean; sort: number; remark: string | null };

export type ResourceType = "file" | "link";
export type ResourceStatus = "draft" | "pending" | "published" | "rejected" | "unpublished";

export type ConsoleResourceListItem = {
  id: string;
  majorId: string;
  majorName: string;
  courseId: string;
  courseName: string;
  title: string;
  resourceType: ResourceType;
  status: ResourceStatus;
  downloadCount: number;
  isBest: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdBy: string;
  authorName: string | null;
  createdAt: string;
};

export type Paginated<T> = { page: number; pageSize: number; total: number; items: T[] };

export type ConsoleResourceDetail = {
  id: string;
  majorId: string;
  majorName: string;
  courseId: string;
  courseName: string;
  title: string;
  description: string;
  resourceType: ResourceType;
  status: ResourceStatus;
  file: { bucket: string; key: string; fileName: string; size: number; sha256: string } | null;
  link: { url: string; normalizedUrl: string } | null;
  submittedAt: string | null;
  review: { reviewedBy: string | null; reviewedAt: string | null; comment: string | null };
  publishedAt: string | null;
  unpublishedAt: string | null;
  downloadCount: number;
  lastDownloadAt: string | null;
  isBest: boolean;
  createdBy: string;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
};

export function fetchConsoleMajors() {
  return apiGetJson<Major[]>("/api/console/resources/majors");
}

export function createConsoleMajor(body: { name: string; enabled?: boolean; sort?: number; remark?: string | null; reason?: string }) {
  return apiPostJson<{ id: string }>("/api/console/resources/majors", body);
}

export function updateConsoleMajor(
  id: string,
  body: { name?: string; enabled?: boolean; sort?: number; remark?: string | null; reason?: string },
) {
  return apiPutJson<{ ok: true }>(`/api/console/resources/majors/${id}`, body);
}

export function deleteConsoleMajor(id: string, params?: { reason?: string }) {
  const sp = new URLSearchParams();
  if (params?.reason) sp.set("reason", params.reason);
  const qs = sp.toString();
  return apiDeleteJson<{ ok: true }>(qs ? `/api/console/resources/majors/${id}?${qs}` : `/api/console/resources/majors/${id}`);
}

export type MajorLeadItem = { userId: string; name: string | null; username: string | null; email: string | null };

export function fetchConsoleMajorLeads(majorId: string) {
  return apiGetJson<MajorLeadItem[]>(`/api/console/resources/majors/${majorId}/leads`);
}

export function setConsoleMajorLeads(majorId: string, body: { userIds: string[]; reason?: string }) {
  return apiPutJson<{ ok: true }>(`/api/console/resources/majors/${majorId}/leads`, body);
}

export function fetchConsoleCourses(params?: { majorId?: string }) {
  const sp = new URLSearchParams();
  if (params?.majorId) sp.set("majorId", params.majorId);
  const qs = sp.toString();
  return apiGetJson<Course[]>(qs ? `/api/console/resources/courses?${qs}` : "/api/console/resources/courses");
}

export function createConsoleCourse(body: {
  majorId: string;
  name: string;
  code?: string | null;
  enabled?: boolean;
  sort?: number;
  remark?: string | null;
  reason?: string;
}) {
  return apiPostJson<{ id: string }>("/api/console/resources/courses", body);
}

export function updateConsoleCourse(
  id: string,
  body: { majorId?: string; name?: string; code?: string | null; enabled?: boolean; sort?: number; remark?: string | null; reason?: string },
) {
  return apiPutJson<{ ok: true }>(`/api/console/resources/courses/${id}`, body);
}

export function deleteConsoleCourse(id: string, params?: { reason?: string }) {
  const sp = new URLSearchParams();
  if (params?.reason) sp.set("reason", params.reason);
  const qs = sp.toString();
  return apiDeleteJson<{ ok: true }>(qs ? `/api/console/resources/courses/${id}?${qs}` : `/api/console/resources/courses/${id}`);
}

export function fetchConsoleResources(params: {
  page?: number;
  pageSize?: number;
  status?: ResourceStatus;
  majorId?: string;
  courseId?: string;
  q?: string;
}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.status) sp.set("status", params.status);
  if (params.majorId) sp.set("majorId", params.majorId);
  if (params.courseId) sp.set("courseId", params.courseId);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  const qs = sp.toString();
  return apiGetJson<Paginated<ConsoleResourceListItem>>(qs ? `/api/console/resources?${qs}` : "/api/console/resources");
}

export function fetchConsoleResourceDetail(id: string) {
  return apiGetJson<ConsoleResourceDetail>(`/api/console/resources/${id}`);
}

export function approveConsoleResource(id: string, body?: { comment?: string; reason?: string }) {
  return apiPostJson<ConsoleResourceDetail>(`/api/console/resources/${id}/approve`, body ?? {});
}

export function rejectConsoleResource(id: string, body: { comment: string; reason?: string }) {
  return apiPostJson<ConsoleResourceDetail>(`/api/console/resources/${id}/reject`, body);
}

export function offlineConsoleResource(id: string, body?: { reason?: string }) {
  return apiPostJson<ConsoleResourceDetail>(`/api/console/resources/${id}/offline`, body ?? {});
}

export function bestConsoleResource(id: string, body?: { reason?: string }) {
  return apiPostJson<ConsoleResourceDetail>(`/api/console/resources/${id}/best`, body ?? {});
}

export function unbestConsoleResource(id: string, body?: { reason?: string }) {
  return apiPostJson<ConsoleResourceDetail>(`/api/console/resources/${id}/unbest`, body ?? {});
}

export function hardDeleteConsoleResource(id: string, params?: { reason?: string }) {
  const sp = new URLSearchParams();
  if (params?.reason) sp.set("reason", params.reason);
  const qs = sp.toString();
  return apiDeleteJson<{ ok: true }>(qs ? `/api/console/resources/${id}?${qs}` : `/api/console/resources/${id}`);
}

