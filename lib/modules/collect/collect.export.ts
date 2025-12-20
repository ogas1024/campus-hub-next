import { sanitizeFileName } from "@/lib/utils/fileName";
import type { CollectSubmissionStatus } from "./collect.types";

export function sanitizeForCsvFormula(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[=+\-@]/.test(trimmed)) return `'${trimmed}`;
  return trimmed;
}

export function escapeCsvCell(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildManifestCsv(params: {
  rows: Array<{
    studentId: string;
    name: string;
    departments: string[];
    submittedAt: Date | null;
    status: CollectSubmissionStatus;
    missingRequired: boolean;
    missingRequiredItems: string[];
    fileCount: number;
    totalBytes: number;
  }>;
}) {
  const header = ["学号", "姓名", "部门", "提交时间", "状态", "缺材料", "缺失必交项", "文件数", "总大小(MB)"];
  const lines: string[] = [];
  lines.push(header.map((h) => escapeCsvCell(sanitizeForCsvFormula(h))).join(","));

  for (const r of params.rows) {
    const row = [
      r.studentId,
      r.name,
      r.departments.join(" / "),
      r.submittedAt ? r.submittedAt.toISOString() : "",
      r.status,
      r.missingRequired ? "是" : "否",
      r.missingRequiredItems.join(" / "),
      String(r.fileCount),
      (r.totalBytes / (1024 * 1024)).toFixed(2),
    ];
    lines.push(row.map((c) => escapeCsvCell(sanitizeForCsvFormula(c))).join(","));
  }

  return lines.join("\n");
}

function sanitizeZipSegment(input: string, fallback: string) {
  const raw = sanitizeFileName(input);
  const stripped = raw.replace(/^\.+/, "").trim();
  if (!stripped || stripped === "." || stripped === "..") return fallback;
  return stripped;
}

export function buildZipPath(params: { studentId: string; name: string; itemTitle: string; fileName: string }) {
  const sid = sanitizeZipSegment(params.studentId, "");
  const name = sanitizeZipSegment(params.name, "");
  const student = sanitizeZipSegment([sid, name].filter(Boolean).join("-"), "unknown");
  const item = sanitizeZipSegment(params.itemTitle, "未命名材料项");
  const file = sanitizeZipSegment(params.fileName, "file");
  return `${student}/${item}/${file}`;
}
