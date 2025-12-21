import { z } from "zod";

export const libraryBookStatusSchema = z.enum(["draft", "pending", "published", "rejected", "unpublished"]);
export const libraryFileFormatSchema = z.enum(["pdf", "epub", "mobi", "zip"]);

export const createMyLibraryBookDraftBodySchema = z.object({
  isbn13: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  summary: z.string().max(2000).optional().nullable(),
  keywords: z.string().max(500).optional().nullable(),
});

export const updateMyLibraryBookBodySchema = z
  .object({
    isbn13: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    author: z.string().min(1).optional(),
    summary: z.string().max(2000).optional().nullable(),
    keywords: z.string().max(500).optional().nullable(),
  })
  .strict();

export const createMyLibraryBookUploadUrlBodySchema = z
  .object({
    format: libraryFileFormatSchema,
    fileName: z.string().min(1),
    size: z.number().int().positive(),
    contentType: z.string().optional(),
  })
  .strict();

export const createMyLibraryBookLinkAssetBodySchema = z
  .object({
    url: z.string().min(1),
  })
  .strict();

export const favoriteBodySchema = z
  .object({
    favorite: z.boolean(),
  })
  .strict();

export const reviewApproveBodySchema = z
  .object({
    comment: z.string().max(2000).optional(),
    reason: z.string().max(2000).optional(),
  })
  .strict();

export const reviewRejectBodySchema = z
  .object({
    comment: z.string().min(1).max(2000),
    reason: z.string().max(2000).optional(),
  })
  .strict();

export const offlineBodySchema = z
  .object({
    reason: z.string().max(2000).optional(),
  })
  .strict();

