import "server-only";

import { HttpError } from "@/lib/http/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  StorageAdapter,
  StorageSignedDownloadUrlParams,
  StorageSignedDownloadUrlResult,
  StorageUploadParams,
  StorageUploadResult,
} from "@/lib/storage/storageAdapter";

function formatStorageError(prefix: string, err: unknown) {
  const e = err as { message?: string; status?: number; statusCode?: string } | null;
  const status = e?.status ?? e?.statusCode;
  const message = e?.message ? String(e.message) : "未知错误";
  return `${prefix}（${status ?? "unknown"}）：${message}`;
}

export class SupabaseStorageAdapter implements StorageAdapter {
  private readonly supabase = createSupabaseAdminClient();

  getPublicUrl(params: { bucket: string; key: string }): string {
    const { data } = this.supabase.storage.from(params.bucket).getPublicUrl(params.key);
    return data.publicUrl;
  }

  async uploadPublic(params: StorageUploadParams): Promise<StorageUploadResult> {
    const { error } = await this.supabase.storage.from(params.bucket).upload(params.key, params.file, {
      upsert: params.upsert,
      contentType: params.contentType,
      cacheControl: params.cacheControl ?? "3600",
    });

    if (error) {
      throw new HttpError(500, "INTERNAL_ERROR", formatStorageError("文件上传失败", error));
    }

    return {
      bucket: params.bucket,
      key: params.key,
      publicUrl: this.getPublicUrl({ bucket: params.bucket, key: params.key }),
    };
  }

  async uploadPrivate(params: StorageUploadParams): Promise<{ bucket: string; key: string }> {
    const { error } = await this.supabase.storage.from(params.bucket).upload(params.key, params.file, {
      upsert: params.upsert,
      contentType: params.contentType,
      cacheControl: params.cacheControl ?? "3600",
    });

    if (error) {
      throw new HttpError(500, "INTERNAL_ERROR", formatStorageError("文件上传失败", error));
    }

    return { bucket: params.bucket, key: params.key };
  }

  async createSignedDownloadUrl(params: StorageSignedDownloadUrlParams): Promise<StorageSignedDownloadUrlResult> {
    const { data, error } = await this.supabase.storage
      .from(params.bucket)
      .createSignedUrl(params.key, params.expiresIn, params.download ? { download: params.download } : undefined);

    if (error || !data?.signedUrl) {
      throw new HttpError(500, "INTERNAL_ERROR", formatStorageError("生成签名下载链接失败", error));
    }

    return { bucket: params.bucket, key: params.key, signedUrl: data.signedUrl };
  }

  async remove(params: { bucket: string; keys: string[] }): Promise<void> {
    const keys = params.keys.map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0) return;

    const { error } = await this.supabase.storage.from(params.bucket).remove(keys);
    if (!error) return;

    const status = (error as { status?: number; statusCode?: string } | null)?.status ?? (error as { statusCode?: string } | null)?.statusCode;
    if (status === 404 || status === "404") return;

    throw new HttpError(500, "INTERNAL_ERROR", formatStorageError("文件删除失败", error));
  }
}
