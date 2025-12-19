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

export const courseResourceTypeEnum = pgEnum("course_resource_type", ["file", "link"]);
export const courseResourceStatusEnum = pgEnum("course_resource_status", ["draft", "pending", "published", "rejected", "unpublished"]);
export const courseResourceScoreEventTypeEnum = pgEnum("course_resource_score_event_type", ["approve", "best"]);

export const majors = pgTable(
  "majors",
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
    nameIdx: index("majors_name_idx").on(t.name),
    enabledIdx: index("majors_enabled_idx").on(t.enabled),
  }),
);

export const majorLeads = pgTable(
  "major_leads",
  {
    majorId: uuid("major_id")
      .notNull()
      .references(() => majors.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "major_leads_pk", columns: [t.majorId, t.userId] }),
    userIdIdx: index("major_leads_user_id_idx").on(t.userId),
  }),
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    majorId: uuid("major_id")
      .notNull()
      .references(() => majors.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: text("code"),
    enabled: boolean("enabled").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    remark: text("remark"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    majorIdIdx: index("courses_major_id_idx").on(t.majorId),
    nameIdx: index("courses_name_idx").on(t.name),
    enabledIdx: index("courses_enabled_idx").on(t.enabled),
  }),
);

export const courseResources = pgTable(
  "course_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    majorId: uuid("major_id")
      .notNull()
      .references(() => majors.id, { onDelete: "restrict" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),

    title: text("title").notNull(),
    description: text("description").notNull(),

    resourceType: courseResourceTypeEnum("resource_type").notNull(),
    status: courseResourceStatusEnum("status").notNull().default("draft"),

    fileBucket: text("file_bucket"),
    fileKey: text("file_key"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    sha256: text("sha256"),

    linkUrl: text("link_url"),
    linkUrlNormalized: text("link_url_normalized"),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewComment: text("review_comment"),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),

    downloadCount: integer("download_count").notNull().default(0),
    lastDownloadAt: timestamp("last_download_at", { withTimezone: true }),

    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("course_resources_status_idx").on(t.status),
    majorIdIdx: index("course_resources_major_id_idx").on(t.majorId),
    courseIdIdx: index("course_resources_course_id_idx").on(t.courseId),
    createdByIdx: index("course_resources_created_by_idx").on(t.createdBy),
    downloadCountIdx: index("course_resources_download_count_idx").on(t.downloadCount),
  }),
);

export const courseResourceBests = pgTable(
  "course_resource_bests",
  {
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => courseResources.id, { onDelete: "cascade" }),
    bestBy: uuid("best_by").notNull(),
    bestAt: timestamp("best_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "course_resource_bests_pk", columns: [t.resourceId] }),
    bestAtIdx: index("course_resource_bests_best_at_idx").on(t.bestAt),
  }),
);

export const courseResourceDownloadEvents = pgTable(
  "course_resource_download_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => courseResources.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => ({
    resourceIdIdx: index("course_resource_download_events_resource_id_idx").on(t.resourceId),
    occurredAtIdx: index("course_resource_download_events_occurred_at_idx").on(t.occurredAt),
    userIdIdx: index("course_resource_download_events_user_id_idx").on(t.userId),
  }),
);

export const courseResourceScoreEvents = pgTable(
  "course_resource_score_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    majorId: uuid("major_id").notNull(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => courseResources.id, { onDelete: "cascade" }),
    eventType: courseResourceScoreEventTypeEnum("event_type").notNull(),
    delta: integer("delta").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    resourceIdIdx: index("course_resource_score_events_resource_id_idx").on(t.resourceId),
    majorIdIdx: index("course_resource_score_events_major_id_idx").on(t.majorId),
    userIdIdx: index("course_resource_score_events_user_id_idx").on(t.userId),
    firstUq: uniqueIndex("course_resource_score_events_first_uq").on(t.userId, t.resourceId, t.eventType),
  }),
);

