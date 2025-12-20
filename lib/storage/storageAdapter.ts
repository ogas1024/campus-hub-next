export type StorageUploadParams = {
  bucket: string;
  key: string;
  file: Blob;
  contentType: string;
  upsert: boolean;
  cacheControl?: string;
};

export type StorageUploadResult = {
  bucket: string;
  key: string;
  publicUrl: string;
};

export type StorageSignedDownloadUrlParams = {
  bucket: string;
  key: string;
  expiresIn: number;
  download?: string | true;
};

export type StorageSignedDownloadUrlResult = {
  bucket: string;
  key: string;
  signedUrl: string;
};

export interface StorageAdapter {
  uploadPublic(params: StorageUploadParams): Promise<StorageUploadResult>;
  uploadPrivate(params: StorageUploadParams): Promise<{ bucket: string; key: string }>;
  createSignedDownloadUrl(params: StorageSignedDownloadUrlParams): Promise<StorageSignedDownloadUrlResult>;
  remove(params: { bucket: string; keys: string[] }): Promise<void>;
  getPublicUrl(params: { bucket: string; key: string }): string;
}
