import { z } from "zod";

export const scopeTypeSchema = z.enum(["ALL", "CUSTOM", "DEPT", "DEPT_AND_CHILD", "SELF", "NONE"]);

export const roleDataScopeItemSchema = z
  .object({
    module: z.string().trim().min(1).max(50),
    scopeType: scopeTypeSchema,
    departmentIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

export const setRoleDataScopesBodySchema = z
  .object({
    items: z.array(roleDataScopeItemSchema).max(200),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

