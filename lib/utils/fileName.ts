export function sanitizeFileName(input: string) {
  const raw = input.trim();
  const base = raw.split(/[\\/]/).pop() ?? raw;
  return base
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .trim()
    .slice(0, 180);
}

export function sanitizeStorageObjectKeyPart(input: string) {
  const raw = input.trim();
  const base = raw.split(/[\\/]/).pop() ?? raw;

  const lastDot = base.lastIndexOf(".");
  const extRaw = lastDot > 0 ? base.slice(lastDot) : "";
  const stemRaw = lastDot > 0 ? base.slice(0, lastDot) : base;

  const ext = extRaw
    .replace(/[^a-zA-Z0-9.]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 16);
  const stem = stemRaw
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+/, "")
    .replace(/[_-]+$/, "")
    .slice(0, 160);

  const normalizedExt = ext && ext !== "." ? ext : "";
  const safe = `${stem || "file"}${normalizedExt}`;

  return safe.slice(0, 180);
}
