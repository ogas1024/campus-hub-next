import { z } from "zod";

const uuidArray = z.array(z.string().uuid()).max(50).default([]);

export const createMyReservationBodySchema = z
  .object({
    roomId: z.string().uuid(),
    startAt: z.string().trim().min(1),
    endAt: z.string().trim().min(1),
    purpose: z.string().trim().min(1).max(200),
    participantUserIds: uuidArray,
  })
  .strict();

export const updateMyReservationBodySchema = z
  .object({
    startAt: z.string().trim().min(1),
    endAt: z.string().trim().min(1),
    purpose: z.string().trim().min(1).max(200),
    participantUserIds: uuidArray,
  })
  .strict();

export const cancelReservationBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const createBuildingBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean().default(true),
    sort: z.number().int().min(0).max(9999).default(0),
    remark: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const updateBuildingBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    enabled: z.boolean().optional(),
    sort: z.number().int().min(0).max(9999).optional(),
    remark: z.string().trim().min(1).max(500).nullable().optional(),
  })
  .strict();

export const createRoomBodySchema = z
  .object({
    buildingId: z.string().uuid(),
    floorNo: z.number().int().min(-50).max(200),
    name: z.string().trim().min(1).max(100),
    capacity: z.number().int().min(0).max(9999).nullable().optional(),
    enabled: z.boolean().default(true),
    sort: z.number().int().min(0).max(9999).default(0),
    remark: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const updateRoomBodySchema = z
  .object({
    floorNo: z.number().int().min(-50).max(200).optional(),
    name: z.string().trim().min(1).max(100).optional(),
    capacity: z.number().int().min(0).max(9999).nullable().optional(),
    enabled: z.boolean().optional(),
    sort: z.number().int().min(0).max(9999).optional(),
    remark: z.string().trim().min(1).max(500).nullable().optional(),
  })
  .strict();

export const rejectReservationBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const updateFacilityConfigBodySchema = z
  .object({
    auditRequired: z.boolean().optional(),
    maxDurationHours: z.number().int().min(1).max(168).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const createFacilityBanBodySchema = z
  .object({
    userId: z.string().uuid(),
    duration: z.string().trim().min(1).max(50).optional(),
    expiresAt: z.string().trim().min(1).max(100).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const revokeFacilityBanBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
