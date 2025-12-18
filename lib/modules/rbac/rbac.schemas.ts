import { z } from "zod";

export const createRoleBodySchema = z
  .object({
    code: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(500).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const updateRoleBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().min(1).max(500).nullable().optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const setRolePermissionsBodySchema = z
  .object({
    permissionCodes: z.array(z.string().trim().min(1)).max(500),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

