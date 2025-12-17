import { z } from "zod";

export const createDepartmentBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    parentId: z.string().uuid().nullable().optional(),
    sort: z.number().int().min(0).max(1_000_000).default(0),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const updateDepartmentBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    parentId: z.string().uuid().nullable().optional(),
    sort: z.number().int().min(0).max(1_000_000).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const createPositionBodySchema = z
  .object({
    code: z.string().trim().min(1).max(50).optional(),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(500).optional(),
    enabled: z.boolean().default(true),
    sort: z.number().int().min(0).max(1_000_000).default(0),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const updatePositionBodySchema = z
  .object({
    code: z.string().trim().min(1).max(50).nullable().optional(),
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().min(1).max(500).nullable().optional(),
    enabled: z.boolean().optional(),
    sort: z.number().int().min(0).max(1_000_000).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

