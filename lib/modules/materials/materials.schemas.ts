import { z } from "zod";

export const scopeSchema = z.object({
  scopeType: z.enum(["role", "department", "position"]),
  refId: z.string().uuid(),
});

const dueAtSchema = z
  .string()
  .datetime()
  .transform((value) => new Date(value))
  .nullable()
  .optional();

export const materialItemInputSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    required: z.boolean().default(false),
    sort: z.number().int().nonnegative().default(0),
  })
  .strict();

export const createMaterialBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    descriptionMd: z.string().default(""),
    noticeId: z.string().uuid().optional().nullable(),
    visibleAll: z.boolean().default(true),
    scopes: z.array(scopeSchema).default([]),
    maxFilesPerSubmission: z.number().int().min(1).max(50).default(10),
    dueAt: dueAtSchema,
    items: z.array(materialItemInputSchema).default([]),
  })
  .strict();

export const updateMaterialDraftBodySchema = createMaterialBodySchema;

export const updateMaterialDueAtBodySchema = z
  .object({
    dueAt: z.string().datetime().transform((value) => new Date(value)),
  })
  .strict();

export const batchProcessSubmissionsBodySchema = z
  .object({
    submissionIds: z.array(z.string().uuid()).min(1),
    action: z.enum(["assignToMe", "unassign", "setStatus"]),
    status: z.enum(["pending", "complete", "need_more", "approved", "rejected"]).optional(),
    studentMessage: z.string().trim().max(2000).optional().nullable(),
    staffNote: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();
