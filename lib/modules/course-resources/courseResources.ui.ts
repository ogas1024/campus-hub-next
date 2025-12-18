export type CourseResourceStatus = "draft" | "pending" | "published" | "rejected" | "unpublished";
export type CourseResourceType = "file" | "link";

export function getCourseResourceStatusMeta(status: CourseResourceStatus) {
  switch (status) {
    case "draft":
      return { label: "草稿", className: "bg-muted text-muted-foreground" };
    case "pending":
      return { label: "待审核", className: "bg-amber-500/10 text-amber-700" };
    case "published":
      return { label: "已发布", className: "bg-emerald-500/10 text-emerald-700" };
    case "rejected":
      return { label: "已驳回", className: "bg-rose-500/10 text-rose-700" };
    case "unpublished":
      return { label: "已下架", className: "bg-muted text-muted-foreground" };
  }
}

export function getCourseResourceTypeLabel(type: CourseResourceType) {
  switch (type) {
    case "file":
      return "文件";
    case "link":
      return "外链";
  }
}

export function formatFileSize(size: number) {
  const mb = size / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  const kb = size / 1024;
  if (kb >= 1) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  return `${size} B`;
}

