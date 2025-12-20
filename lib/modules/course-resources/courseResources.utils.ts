export const COURSE_RESOURCES_BUCKET = "course-resources";

export const COURSE_RESOURCES_MAX_FILE_SIZE = 200 * 1024 * 1024;

const ALLOWED_ARCHIVE_EXTS = [".zip", ".rar", ".7z"] as const;

export { sanitizeFileName, sanitizeStorageObjectKeyPart } from "@/lib/utils/fileName";

export function isAllowedArchiveFileName(fileName: string) {
  const name = fileName.trim().toLowerCase();
  return ALLOWED_ARCHIVE_EXTS.some((ext) => name.endsWith(ext));
}

function hasScheme(value: string) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);
}

export function normalizeExternalUrl(input: string) {
  const raw = input.trim();
  if (!raw) throw new Error("URL 不能为空");

  const withScheme = raw.startsWith("//") ? `https:${raw}` : hasScheme(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("URL 不合法");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("仅支持 http/https");
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/g, "");
  }

  const entries = [...url.searchParams.entries()];
  entries.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  url.search = "";
  for (const [k, v] of entries) url.searchParams.append(k, v);

  return url.toString();
}
