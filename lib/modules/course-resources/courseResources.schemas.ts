import { z } from "zod";

import { COURSE_RESOURCES_MAX_FILE_SIZE, isAllowedArchiveFileName } from "@/lib/modules/course-resources/courseResources.utils";

export const resourceTypeSchema = z.enum(["file", "link"]);
export const resourceStatusSchema = z.enum(["draft", "pending", "published", "rejected", "unpublished"]);

export const createMajorBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean().default(true),
    sort: z.number().int().min(0).max(1_000_000).default(0),
    remark: z.string().trim().min(1).max(500).nullable().optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const updateMajorBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    enabled: z.boolean().optional(),
    sort: z.number().int().min(0).max(1_000_000).optional(),
    remark: z.string().trim().min(1).max(500).nullable().optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const setMajorLeadsBodySchema = z
  .object({
    userIds: z.array(z.string().uuid()).default([]),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const createCourseBodySchema = z
  .object({
    majorId: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
    code: z.string().trim().min(1).max(50).nullable().optional(),
    enabled: z.boolean().default(true),
    sort: z.number().int().min(0).max(1_000_000).default(0),
    remark: z.string().trim().min(1).max(500).nullable().optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const updateCourseBodySchema = z
  .object({
    majorId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100).optional(),
    code: z.string().trim().min(1).max(50).nullable().optional(),
    enabled: z.boolean().optional(),
    sort: z.number().int().min(0).max(1_000_000).optional(),
    remark: z.string().trim().min(1).max(500).nullable().optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const createMyResourceDraftBodySchema = z
  .object({
    majorId: z.string().uuid(),
    courseId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2000),
    resourceType: resourceTypeSchema,
  })
  .strict();

export const updateMyResourceBodySchema = z
  .object({
    majorId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    resourceType: resourceTypeSchema.optional(),
    linkUrl: z.string().trim().min(1).max(2000).nullable().optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const createUploadUrlBodySchema = z
  .object({
    fileName: z.string().trim().min(1).max(200),
    size: z.number().int().min(1).max(COURSE_RESOURCES_MAX_FILE_SIZE),
    sha256: z.string().trim().regex(/^[0-9a-f]{64}$/i, "sha256 必须为 64 位十六进制"),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!isAllowedArchiveFileName(val.fileName)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "仅允许 zip/rar/7z 压缩包", path: ["fileName"] });
    }
  });

export const reviewApproveBodySchema = z
  .object({
    comment: z.string().trim().min(1).max(500).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const reviewRejectBodySchema = z
  .object({
    comment: z.string().trim().min(1).max(500),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const offlineBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const bestBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

