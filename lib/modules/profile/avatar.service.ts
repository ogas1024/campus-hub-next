import "server-only";

import { badRequest, HttpError } from "@/lib/http/errors";
import { storageAdapter } from "@/lib/storage";
import { setMyAvatarUrl } from "@/lib/modules/profile/profile.service";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function avatarKey(userId: string) {
  return `users/${userId}/avatar`;
}

function assertValidAvatarFile(file: Blob) {
  if (file.size <= 0) throw badRequest("头像文件为空");
  if (file.size > MAX_AVATAR_BYTES) throw badRequest("头像文件过大（最大 2MB）");

  const contentType = (file as { type?: string } | null)?.type ?? "";
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    throw badRequest("头像仅支持 PNG/JPEG/WEBP");
  }

  return contentType;
}

export async function uploadMyAvatar(params: { userId: string; file: Blob }) {
  const contentType = assertValidAvatarFile(params.file);
  const key = avatarKey(params.userId);

  const uploaded = await storageAdapter.uploadPublic({
    bucket: AVATAR_BUCKET,
    key,
    file: params.file,
    contentType,
    upsert: true,
    cacheControl: "3600",
  });

  if (!uploaded.publicUrl) {
    throw new HttpError(500, "INTERNAL_ERROR", "头像上传成功但未获取到 public URL");
  }

  const avatarUrl = `${uploaded.publicUrl}?v=${Date.now()}`;
  return setMyAvatarUrl({ userId: params.userId, avatarUrl });
}

export async function removeMyAvatar(params: { userId: string }) {
  const key = avatarKey(params.userId);
  await storageAdapter.remove({ bucket: AVATAR_BUCKET, keys: [key] });
  return setMyAvatarUrl({ userId: params.userId, avatarUrl: null });
}
