import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const noticeStatusEnum = pgEnum("notice_status", ["draft", "published", "retracted"]);
export const noticeScopeTypeEnum = pgEnum("notice_scope_type", ["role", "department", "position"]);

export const notices = pgTable(
  "notices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    contentMd: text("content_md").notNull(),
    status: noticeStatusEnum("status").notNull().default("draft"),

    visibleAll: boolean("visible_all").notNull().default(false),
    pinned: boolean("pinned").notNull().default(false),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),

    publishAt: timestamp("publish_at", { withTimezone: true }),
    expireAt: timestamp("expire_at", { withTimezone: true }),

    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),

    editCount: integer("edit_count").notNull().default(0),
    readCount: integer("read_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("notices_status_idx").on(t.status),
    publishAtIdx: index("notices_publish_at_idx").on(t.publishAt),
    pinnedAtIdx: index("notices_pinned_at_idx").on(t.pinnedAt),
    createdByIdx: index("notices_created_by_idx").on(t.createdBy),
  }),
);

export const noticeScopes = pgTable(
  "notice_scopes",
  {
    noticeId: uuid("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    scopeType: noticeScopeTypeEnum("scope_type").notNull(),
    refId: uuid("ref_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "notice_scopes_pk", columns: [t.noticeId, t.scopeType, t.refId] }),
    noticeIdIdx: index("notice_scopes_notice_id_idx").on(t.noticeId),
  }),
);

export const noticeAttachments = pgTable(
  "notice_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noticeId: uuid("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    noticeIdIdx: index("notice_attachments_notice_id_idx").on(t.noticeId),
  }),
);

export const noticeReads = pgTable(
  "notice_reads",
  {
    noticeId: uuid("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "notice_reads_pk", columns: [t.noticeId, t.userId] }),
    noticeIdIdx: index("notice_reads_notice_id_idx").on(t.noticeId),
    userIdIdx: index("notice_reads_user_id_idx").on(t.userId),
  }),
);
