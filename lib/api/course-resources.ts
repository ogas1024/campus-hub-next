import { apiDeleteJson, apiGetJson, apiPostJson, apiPutJson } from "@/lib/api/http";

export type ResourceType = "file" | "link";
export type ResourceStatus = "draft" | "pending" | "published" | "rejected" | "unpublished";

export type Major = { id: string; name: string; enabled: boolean; sort: number; remark?: string | null };
export type Course = { id: string; majorId: string; name: string; code: string | null; enabled: boolean; sort: number; remark?: string | null };

export type CourseResourceListItem = {
  id: string;
  majorId: string;
  courseId: string;
  title: string;
  description: string;
  resourceType: ResourceType;
  status: ResourceStatus;
  downloadCount: number;
  isBest: boolean;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
};

export type CourseResourceDetail = {
  id: string;
  majorId: string;
  courseId: string;
  title: string;
  description: string;
  resourceType: ResourceType;
  status: ResourceStatus;
  file: { bucket: string; key: string; fileName: string; size: number; sha256: string; downloadUrl?: string | null } | null;
  link: { url: string; normalizedUrl: string } | null;
  review?: { reviewedBy: string | null; reviewedAt: string | null; comment: string | null };
  publishedAt: string | null;
  unpublishedAt: string | null;
  downloadCount: number;
  isBest: boolean;
  createdBy: string;
  createdAt: string;
};

export type Paginated<T> = { page: number; pageSize: number; total: number; items: T[] };

export function fetchPortalMajors() {
  return apiGetJson<Major[]>("/api/resources/majors");
}

export function fetchPortalCourses(majorId: string) {
  return apiGetJson<Course[]>(`/api/resources/courses?majorId=${encodeURIComponent(majorId)}`);
}

export function fetchPortalResources(params: { courseId: string; page?: number; pageSize?: number; q?: string }) {
  const sp = new URLSearchParams();
  sp.set("courseId", params.courseId);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  const query = sp.toString();
  return apiGetJson<Paginated<CourseResourceListItem>>(`/api/resources?${query}`);
}

export function fetchPortalResourceDetail(id: string) {
  return apiGetJson<CourseResourceDetail>(`/api/resources/${encodeURIComponent(id)}`);
}

export function fetchMyResources(params: { page?: number; pageSize?: number; status?: ResourceStatus; q?: string }) {
  const sp = new URLSearchParams();
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.status) sp.set("status", params.status);
  if (params.q && params.q.trim()) sp.set("q", params.q.trim());
  const query = sp.toString();
  return apiGetJson<Paginated<CourseResourceListItem>>(query ? `/api/me/resources?${query}` : "/api/me/resources");
}

export function createMyResourceDraft(body: {
  majorId: string;
  courseId: string;
  title: string;
  description: string;
  resourceType: ResourceType;
}) {
  return apiPostJson<CourseResourceDetail>("/api/me/resources", body);
}

export function fetchMyResourceDetail(id: string) {
  return apiGetJson<CourseResourceDetail>(`/api/me/resources/${encodeURIComponent(id)}`);
}

export function updateMyResource(
  id: string,
  body: Partial<{
    majorId: string;
    courseId: string;
    title: string;
    description: string;
    resourceType: ResourceType;
    linkUrl: string | null;
  }>,
) {
  return apiPutJson<CourseResourceDetail>(`/api/me/resources/${encodeURIComponent(id)}`, body);
}

export function deleteMyResource(id: string) {
  return apiDeleteJson<{ ok: true }>(`/api/me/resources/${encodeURIComponent(id)}`);
}

export function submitMyResource(id: string) {
  return apiPostJson<CourseResourceDetail>(`/api/me/resources/${encodeURIComponent(id)}/submit`);
}

export function unpublishMyResource(id: string) {
  return apiPostJson<CourseResourceDetail>(`/api/me/resources/${encodeURIComponent(id)}/unpublish`);
}

export function createMyResourceUploadUrl(id: string, body: { fileName: string; size: number; sha256: string }) {
  return apiPostJson<{ bucket: string; key: string; token: string; uploadUrl: string }>(
    `/api/me/resources/${encodeURIComponent(id)}/upload-url`,
    body,
  );
}

