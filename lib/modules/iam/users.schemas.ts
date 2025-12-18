import { z } from "zod";

const uuidArray = z.array(z.string().uuid()).max(200).default([]);
const supabaseBanDurationRegex = /^(?:\d+(?:ns|us|µs|ms|s|m|h|d|w|y))+$/;

export const createConsoleUserBodySchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(200).optional(),
    emailConfirm: z.boolean().default(false),
    name: z.string().trim().min(1).max(100),
    studentId: z.string().trim().regex(/^[0-9]{16}$/),
    roleIds: uuidArray,
    departmentIds: uuidArray,
    positionIds: uuidArray,
  })
  .strict();

export const inviteConsoleUserBodySchema = z
  .object({
    email: z.string().trim().email(),
    redirectTo: z.string().trim().url().optional(),
    name: z.string().trim().min(1).max(100),
    studentId: z.string().trim().regex(/^[0-9]{16}$/),
    roleIds: uuidArray,
    departmentIds: uuidArray,
    positionIds: uuidArray,
  })
  .strict();

export const reasonBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const banBodySchema = z
  .object({
    duration: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .refine((v) => v !== "none", { message: "duration 不允许为 none" })
      .refine((v) => supabaseBanDurationRegex.test(v), { message: "duration 格式无效（示例：10m/2h/1h30m/100y）" }),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const setUserRolesBodySchema = z
  .object({
    roleIds: uuidArray,
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const setUserDepartmentsBodySchema = z
  .object({
    departmentIds: uuidArray,
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const setUserPositionsBodySchema = z
  .object({
    positionIds: uuidArray,
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
