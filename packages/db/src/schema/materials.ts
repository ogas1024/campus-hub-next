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

export const collectTaskStatusEnum = pgEnum("collect_task_status", ["draft", "published", "closed"]);
export const collectScopeTypeEnum = pgEnum("collect_scope_type", ["role", "department", "position"]);
export const collectSubmissionStatusEnum = pgEnum("collect_submission_status", ["pending", "complete", "need_more", "approved", "rejected"]);
export const collectItemKindEnum = pgEnum("collect_item_kind", ["file"]);
export const collectSourceTypeEnum = pgEnum("collect_source_type", ["notice"]);

export const collectTasks = pgTable(
  "collect_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    module: text("module").notNull(),

    title: text("title").notNull(),
    descriptionMd: text("description_md").notNull().default(""),
    status: collectTaskStatusEnum("status").notNull().default("draft"),

    sourceType: collectSourceTypeEnum("source_type"),
    sourceId: uuid("source_id"),

    visibleAll: boolean("visible_all").notNull().default(true),
    maxFilesPerSubmission: integer("max_files_per_submission").notNull().default(10),
    dueAt: timestamp("due_at", { withTimezone: true }),

    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),

    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    moduleSourceActiveUq: uniqueIndex("collect_tasks_module_source_active_uq")
      .on(t.module, t.sourceType, t.sourceId)
      .where(sql`source_id is not null and deleted_at is null`),
    moduleIdx: index("collect_tasks_module_idx").on(t.module),
    statusIdx: index("collect_tasks_status_idx").on(t.status),
    createdByIdx: index("collect_tasks_created_by_idx").on(t.createdBy),
    archivedAtIdx: index("collect_tasks_archived_at_idx").on(t.archivedAt),
  }),
);

export const collectTaskScopes = pgTable(
  "collect_task_scopes",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => collectTasks.id, { onDelete: "cascade" }),
    scopeType: collectScopeTypeEnum("scope_type").notNull(),
    refId: uuid("ref_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "collect_task_scopes_pk", columns: [t.taskId, t.scopeType, t.refId] }),
    taskIdIdx: index("collect_task_scopes_task_id_idx").on(t.taskId),
  }),
);

export const collectItems = pgTable(
  "collect_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => collectTasks.id, { onDelete: "cascade" }),

    kind: collectItemKindEnum("kind").notNull().default("file"),
    title: text("title").notNull(),
    description: text("description"),
    required: boolean("required").notNull().default(false),
    sort: integer("sort").notNull().default(0),

    templateFileKey: text("template_file_key"),
    templateFileName: text("template_file_name"),
    templateContentType: text("template_content_type"),
    templateSize: integer("template_size"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskIdIdx: index("collect_items_task_id_idx").on(t.taskId),
    kindIdx: index("collect_items_kind_idx").on(t.kind),
    sortIdx: index("collect_items_sort_idx").on(t.sort),
  }),
);

export const collectSubmissions = pgTable(
  "collect_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => collectTasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),

    status: collectSubmissionStatusEnum("status").notNull().default("pending"),
    assigneeUserId: uuid("assignee_user_id"),
    studentMessage: text("student_message"),
    staffNote: text("staff_note"),

    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskUserUq: uniqueIndex("collect_submissions_task_user_uq").on(t.taskId, t.userId),
    taskIdIdx: index("collect_submissions_task_id_idx").on(t.taskId),
    userIdIdx: index("collect_submissions_user_id_idx").on(t.userId),
    statusIdx: index("collect_submissions_status_idx").on(t.status),
    submittedAtIdx: index("collect_submissions_submitted_at_idx").on(t.submittedAt),
    assigneeIdx: index("collect_submissions_assignee_user_id_idx").on(t.assigneeUserId),
  }),
);

export const collectSubmissionFiles = pgTable(
  "collect_submission_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => collectSubmissions.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => collectItems.id, { onDelete: "restrict" }),

    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    sort: integer("sort").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    submissionIdIdx: index("collect_submission_files_submission_id_idx").on(t.submissionId),
    itemIdIdx: index("collect_submission_files_item_id_idx").on(t.itemId),
    createdAtIdx: index("collect_submission_files_created_at_idx").on(t.createdAt),
  }),
);
