export const LIBRARY_BOOKS_BUCKET = "library-books";

export const LIBRARY_MAX_FILE_SIZE = 100 * 1024 * 1024;

export type LibraryBookStatus = "draft" | "pending" | "published" | "rejected" | "unpublished";
export type LibraryAssetType = "file" | "link";
export type LibraryFileFormat = "pdf" | "epub" | "mobi" | "zip";

export const LIBRARY_FILE_EXT_BY_FORMAT: Record<LibraryFileFormat, string> = {
  pdf: ".pdf",
  epub: ".epub",
  mobi: ".mobi",
  zip: ".zip",
};

export const LIBRARY_FILE_FORMAT_PRIORITY: LibraryFileFormat[] = ["pdf", "epub", "mobi", "zip"];

export function getLibraryFileExt(format: LibraryFileFormat) {
  return LIBRARY_FILE_EXT_BY_FORMAT[format];
}

export function normalizeIsbn13(input: string) {
  const raw = input.trim();
  if (!raw) throw new Error("ISBN 不能为空");

  const digits = raw.replace(/[^0-9]/g, "");
  if (!/^[0-9]{13}$/.test(digits)) throw new Error("ISBN 必须为 13 位数字");

  const expected = computeIsbn13CheckDigit(digits.slice(0, 12));
  const actual = Number(digits[12]);
  if (expected !== actual) throw new Error("ISBN 校验位不正确");

  return digits;
}

function computeIsbn13CheckDigit(first12Digits: string) {
  if (!/^[0-9]{12}$/.test(first12Digits)) throw new Error("ISBN 前 12 位必须为数字");

  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(first12Digits[i]);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function isAllowedLibraryFileName(fileName: string) {
  const name = fileName.trim().toLowerCase();
  return Object.values(LIBRARY_FILE_EXT_BY_FORMAT).some((ext) => name.endsWith(ext));
}

export function assertLibraryFile(params: { format: LibraryFileFormat; fileName: string; size: number }) {
  const name = params.fileName.trim();
  if (!name) throw new Error("文件名不能为空");

  const size = Number(params.size);
  if (!Number.isFinite(size) || size <= 0) throw new Error("文件大小必须大于 0");
  if (size > LIBRARY_MAX_FILE_SIZE) throw new Error("文件大小不能超过 100MB");

  const lower = name.toLowerCase();
  const expectedExt = getLibraryFileExt(params.format);
  if (!lower.endsWith(expectedExt)) {
    throw new Error(`文件扩展名必须为 ${expectedExt}`);
  }
}

export function pickDefaultDownloadAssetId(
  assets: Array<{ id: string; assetType: LibraryAssetType; fileFormat: LibraryFileFormat | null }> | null | undefined,
) {
  if (!assets || assets.length === 0) return null;

  const fileAssets = assets
    .filter((a) => a.assetType === "file" && a.fileFormat)
    .map((a) => ({ id: a.id, fileFormat: a.fileFormat! }));

  for (const format of LIBRARY_FILE_FORMAT_PRIORITY) {
    const hit = fileAssets.find((a) => a.fileFormat === format);
    if (hit) return hit.id;
  }

  const link = assets.find((a) => a.assetType === "link");
  return link ? link.id : null;
}
