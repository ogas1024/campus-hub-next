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

export interface StorageAdapter {
  uploadPublic(params: StorageUploadParams): Promise<StorageUploadResult>;
  remove(params: { bucket: string; keys: string[] }): Promise<void>;
  getPublicUrl(params: { bucket: string; key: string }): string;
}

