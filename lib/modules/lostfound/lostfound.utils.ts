import { badRequest } from "@/lib/http/errors";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return uuidRegex.test(value);
}

export function requireUuid(value: string, name: string) {
  if (!value || !isUuid(value)) throw badRequest(`${name} 必须为 UUID`);
  return value;
}

export function parseIsoDateTimeOrNull(value: string | null, name: string) {
  if (value == null) return null;
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) throw badRequest(`${name} 必须为 ISO 时间字符串`);
  return d;
}

export function assertNonEmptyString(value: unknown, name: string) {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw badRequest(`${name} 必填`);
  return v;
}

export function imageKeyPrefix(userId: string) {
  return `users/${userId}/lostfound/`;
}

export function assertOwnedImageKeys(params: { userId: string; keys: string[]; max: number }) {
  const prefix = imageKeyPrefix(params.userId);
  const keys = params.keys.map((k) => k.trim()).filter(Boolean);
  if (keys.length > params.max) throw badRequest(`最多上传 ${params.max} 张图片`);

  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const key of keys) {
    if (!key.startsWith(prefix)) throw badRequest("图片 key 不属于当前用户或格式非法");
    if (key.includes("..")) throw badRequest("图片 key 格式非法");
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  }

  if (duplicates.length > 0) throw badRequest("imageKeys 存在重复", { duplicates });
  return keys;
}

