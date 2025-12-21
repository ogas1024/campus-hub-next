import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const lostfoundItemTypeEnum = pgEnum("lostfound_item_type", ["lost", "found"]);
export const lostfoundItemStatusEnum = pgEnum("lostfound_item_status", ["pending", "published", "rejected", "offline"]);

export const lostfoundItems = pgTable(
  "lostfound_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: lostfoundItemTypeEnum("type").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    location: text("location"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    contactInfo: text("contact_info"),

    status: lostfoundItemStatusEnum("status").notNull().default("pending"),
    publishAt: timestamp("publish_at", { withTimezone: true }),

    rejectReason: text("reject_reason"),
    offlineReason: text("offline_reason"),

    solvedAt: timestamp("solved_at", { withTimezone: true }),

    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),

    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    offlinedBy: uuid("offlined_by"),
    offlinedAt: timestamp("offlined_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("lostfound_items_status_idx").on(t.status),
    publishAtIdx: index("lostfound_items_publish_at_idx").on(t.publishAt),
    createdByIdx: index("lostfound_items_created_by_idx").on(t.createdBy),
    solvedAtIdx: index("lostfound_items_solved_at_idx").on(t.solvedAt),
    createdAtIdx: index("lostfound_items_created_at_idx").on(t.createdAt),
    activePublishAtIdx: index("lostfound_items_active_publish_at_idx")
      .on(t.status, t.publishAt)
      .where(sql`deleted_at is null`),
  }),
);

export const lostfoundItemImages = pgTable(
  "lostfound_item_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => lostfoundItems.id, { onDelete: "cascade" }),

    bucket: text("bucket").notNull(),
    key: text("key").notNull(),
    sortNo: integer("sort_no").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    itemIdIdx: index("lostfound_item_images_item_id_idx").on(t.itemId),
    sortIdx: index("lostfound_item_images_sort_no_idx").on(t.sortNo),
    itemKeyUq: uniqueIndex("lostfound_item_images_item_key_uq").on(t.itemId, t.key),
  }),
);
