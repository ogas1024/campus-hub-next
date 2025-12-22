import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const voteStatusEnum = pgEnum("vote_status", ["draft", "published", "closed"]);
export const voteScopeTypeEnum = pgEnum("vote_scope_type", ["role", "department", "position"]);
export const voteQuestionTypeEnum = pgEnum("vote_question_type", ["single", "multi"]);

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    descriptionMd: text("description_md").notNull().default(""),
    status: voteStatusEnum("status").notNull().default("draft"),

    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),

    anonymousResponses: boolean("anonymous_responses").notNull().default(false),
    visibleAll: boolean("visible_all").notNull().default(true),

    pinned: boolean("pinned").notNull().default(false),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),

    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),

    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("votes_status_idx").on(t.status),
    timeIdx: index("votes_time_idx").on(t.startAt, t.endAt),
    pinnedAtIdx: index("votes_pinned_at_idx").on(t.pinnedAt),
    createdByIdx: index("votes_created_by_idx").on(t.createdBy),
    archivedAtIdx: index("votes_archived_at_idx").on(t.archivedAt),
  }),
);

export const voteScopes = pgTable(
  "vote_scopes",
  {
    voteId: uuid("vote_id")
      .notNull()
      .references(() => votes.id, { onDelete: "cascade" }),
    scopeType: voteScopeTypeEnum("scope_type").notNull(),
    refId: uuid("ref_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "vote_scopes_pk", columns: [t.voteId, t.scopeType, t.refId] }),
    voteIdIdx: index("vote_scopes_vote_id_idx").on(t.voteId),
  }),
);

export const voteQuestions = pgTable(
  "vote_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    voteId: uuid("vote_id")
      .notNull()
      .references(() => votes.id, { onDelete: "cascade" }),
    questionType: voteQuestionTypeEnum("question_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    required: boolean("required").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    maxChoices: integer("max_choices").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    voteIdIdx: index("vote_questions_vote_id_idx").on(t.voteId),
    typeIdx: index("vote_questions_question_type_idx").on(t.questionType),
    sortIdx: index("vote_questions_sort_idx").on(t.sort),
  }),
);

export const voteQuestionOptions = pgTable(
  "vote_question_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => voteQuestions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    questionIdIdx: index("vote_question_options_question_id_idx").on(t.questionId),
    sortIdx: index("vote_question_options_sort_idx").on(t.sort),
  }),
);

export const voteResponses = pgTable(
  "vote_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    voteId: uuid("vote_id")
      .notNull()
      .references(() => votes.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    voteIdIdx: index("vote_responses_vote_id_idx").on(t.voteId),
    userIdIdx: index("vote_responses_user_id_idx").on(t.userId),
    lastSubmitAtIdx: index("vote_responses_updated_at_idx").on(t.updatedAt),
    userUq: uniqueIndex("vote_responses_vote_user_uq").on(t.voteId, t.userId),
  }),
);

export const voteResponseItems = pgTable(
  "vote_response_items",
  {
    responseId: uuid("response_id")
      .notNull()
      .references(() => voteResponses.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => voteQuestions.id, { onDelete: "restrict" }),
    value: jsonb("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "vote_response_items_pk", columns: [t.responseId, t.questionId] }),
    questionIdIdx: index("vote_response_items_question_id_idx").on(t.questionId),
  }),
);

