import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const facilityReservationStatusEnum = pgEnum("facility_reservation_status", ["pending", "approved", "rejected", "cancelled"]);

export const facilityBuildings = pgTable(
  "facility_buildings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    remark: text("remark"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    enabledIdx: index("facility_buildings_enabled_idx").on(t.enabled),
    sortIdx: index("facility_buildings_sort_idx").on(t.sort),
    nameActiveUq: uniqueIndex("facility_buildings_name_active_uq").on(t.name).where(sql`deleted_at is null`),
  }),
);

export const facilityRooms = pgTable(
  "facility_rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    buildingId: uuid("building_id").notNull(),
    floorNo: integer("floor_no").notNull(),
    name: text("name").notNull(),
    capacity: integer("capacity"),
    enabled: boolean("enabled").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    remark: text("remark"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    buildingIdIdx: index("facility_rooms_building_id_idx").on(t.buildingId),
    buildingFloorIdx: index("facility_rooms_building_floor_idx").on(t.buildingId, t.floorNo),
    enabledIdx: index("facility_rooms_enabled_idx").on(t.enabled),
    sortIdx: index("facility_rooms_sort_idx").on(t.sort),
    nameActiveUq: uniqueIndex("facility_rooms_name_active_uq")
      .on(t.buildingId, t.floorNo, t.name)
      .where(sql`deleted_at is null`),
  }),
);

export const facilityReservations = pgTable(
  "facility_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id").notNull(),
    applicantId: uuid("applicant_id").notNull(),
    purpose: text("purpose").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: facilityReservationStatusEnum("status").notNull(),

    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectReason: text("reject_reason"),

    cancelledBy: uuid("cancelled_by"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),

    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    roomIdIdx: index("facility_reservations_room_id_idx").on(t.roomId),
    applicantIdIdx: index("facility_reservations_applicant_id_idx").on(t.applicantId),
    statusIdx: index("facility_reservations_status_idx").on(t.status),
    timeRoomIdx: index("facility_reservations_time_room_idx").on(t.roomId, t.startAt, t.endAt),
  }),
);

export const facilityReservationParticipants = pgTable(
  "facility_reservation_participants",
  {
    reservationId: uuid("reservation_id").notNull(),
    userId: uuid("user_id").notNull(),
    isApplicant: boolean("is_applicant").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "facility_reservation_participants_pk", columns: [t.reservationId, t.userId] }),
    userIdIdx: index("facility_reservation_participants_user_id_idx").on(t.userId),
  }),
);

export const facilityBans = pgTable(
  "facility_bans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    reason: text("reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    createdBy: uuid("created_by").notNull(),
    revokedBy: uuid("revoked_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index("facility_bans_user_id_idx").on(t.userId),
    revokedAtIdx: index("facility_bans_revoked_at_idx").on(t.revokedAt),
    expiresAtIdx: index("facility_bans_expires_at_idx").on(t.expiresAt),
    activeUserUq: uniqueIndex("facility_bans_user_active_uq").on(t.userId).where(sql`revoked_at is null`),
  }),
);
