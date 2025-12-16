import { z } from "zod";

const scopeSchema = z.object({
  scopeType: z.enum(["role", "department", "position"]),
  refId: z.string().uuid(),
});

const attachmentSchema = z.object({
  fileKey: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  sort: z.number().int().nonnegative().default(0),
});

const expireAtSchema = z
  .string()
  .datetime()
  .transform((value) => new Date(value))
  .optional();

export const createNoticeBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    contentMd: z.string().min(1),
    expireAt: expireAtSchema,
    visibleAll: z.boolean(),
    scopes: z.array(scopeSchema).default([]),
    attachments: z.array(attachmentSchema).default([]),
  })
  .strict();

export const updateNoticeBodySchema = createNoticeBodySchema;

export const pinNoticeBodySchema = z.object({ pinned: z.boolean() }).strict();
