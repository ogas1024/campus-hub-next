import type { LibraryBookStatus, LibraryFileFormat } from "@/lib/modules/library/library.utils";

export function getLibraryBookStatusMeta(status: LibraryBookStatus) {
  switch (status) {
    case "draft":
      return { label: "草稿", className: "bg-muted text-muted-foreground" };
    case "pending":
      return { label: "待审核", className: "bg-amber-100 text-amber-900" };
    case "published":
      return { label: "已发布", className: "bg-emerald-100 text-emerald-900" };
    case "rejected":
      return { label: "已驳回", className: "bg-rose-100 text-rose-900" };
    case "unpublished":
      return { label: "已下架", className: "bg-slate-200 text-slate-900" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

export function getLibraryFileFormatLabel(format: LibraryFileFormat) {
  switch (format) {
    case "pdf":
      return "PDF";
    case "epub":
      return "EPUB";
    case "mobi":
      return "MOBI";
    case "zip":
      return "ZIP";
    default:
      return format;
  }
}

