import { z } from "zod";

function isoDateTimeOrNull(name: string) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (typeof v === "string" ? v.trim() : v))
    .refine((v) => v === undefined || v === null || (typeof v === "string" && Number.isFinite(new Date(v).getTime())), {
      message: `${name} 必须为 ISO 时间字符串`,
    });
}

export const lostfoundTypeSchema = z.enum(["lost", "found"]);

export const createLostfoundItemBodySchema = z.object({
  type: lostfoundTypeSchema,
  title: z.string().trim().min(2).max(50),
  content: z.string().trim().min(5).max(2000),
  location: z.union([z.string().trim().max(100), z.null()]).optional().transform((v) => (typeof v === "string" && v.trim() ? v : null)),
  occurredAt: isoDateTimeOrNull("occurredAt"),
  contactInfo: z.union([z.string().trim().max(50), z.null()]).optional().transform((v) => (typeof v === "string" && v.trim() ? v : null)),
  imageKeys: z.array(z.string().trim().min(1)).max(9).optional().default([]),
});

export const updateLostfoundItemBodySchema = z
  .object({
    type: lostfoundTypeSchema.optional(),
    title: z.string().trim().min(2).max(50).optional(),
    content: z.string().trim().min(5).max(2000).optional(),
    location: z
      .union([z.string().trim().max(100), z.null()])
      .optional()
      .transform((v) => (typeof v === "string" ? (v.trim() ? v : null) : v)),
    occurredAt: isoDateTimeOrNull("occurredAt"),
    contactInfo: z
      .union([z.string().trim().max(50), z.null()])
      .optional()
      .transform((v) => (typeof v === "string" ? (v.trim() ? v : null) : v)),
    imageKeys: z.array(z.string().trim().min(1)).max(9).optional(),
  })
  .refine((v) => Object.values(v).some((value) => value !== undefined), { message: "至少提供 1 个字段" });

export const consoleRejectBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const consoleOfflineBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
