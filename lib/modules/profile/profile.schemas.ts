import { z } from "zod";

export const updateMyProfileBodySchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  username: z.string().trim().min(1).max(50).nullable().optional(),
});

export type UpdateMyProfileBody = z.infer<typeof updateMyProfileBodySchema>;
