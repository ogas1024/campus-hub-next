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

export const surveyStatusEnum = pgEnum("survey_status", ["draft", "published", "closed"]);
export const surveyScopeTypeEnum = pgEnum("survey_scope_type", ["role", "department", "position"]);
export const surveyQuestionTypeEnum = pgEnum("survey_question_type", ["text", "single", "multi", "rating"]);

export const surveys = pgTable(
  "surveys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    descriptionMd: text("description_md").notNull().default(""),
    status: surveyStatusEnum("status").notNull().default("draft"),

    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),

    anonymousResponses: boolean("anonymous_responses").notNull().default(false),
    visibleAll: boolean("visible_all").notNull().default(true),

    createdBy: uuid("created_by").notNull(),
    updatedBy: uuid("updated_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("surveys_status_idx").on(t.status),
    timeIdx: index("surveys_time_idx").on(t.startAt, t.endAt),
    createdByIdx: index("surveys_created_by_idx").on(t.createdBy),
  }),
);

export const surveyScopes = pgTable(
  "survey_scopes",
  {
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    scopeType: surveyScopeTypeEnum("scope_type").notNull(),
    refId: uuid("ref_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "survey_scopes_pk", columns: [t.surveyId, t.scopeType, t.refId] }),
    surveyIdIdx: index("survey_scopes_survey_id_idx").on(t.surveyId),
  }),
);

export const surveySections = pgTable(
  "survey_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    surveyIdIdx: index("survey_sections_survey_id_idx").on(t.surveyId),
    sortIdx: index("survey_sections_sort_idx").on(t.sort),
  }),
);

export const surveyQuestions = pgTable(
  "survey_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => surveySections.id, { onDelete: "cascade" }),
    questionType: surveyQuestionTypeEnum("question_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    required: boolean("required").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    surveyIdIdx: index("survey_questions_survey_id_idx").on(t.surveyId),
    sectionIdIdx: index("survey_questions_section_id_idx").on(t.sectionId),
    typeIdx: index("survey_questions_question_type_idx").on(t.questionType),
    sortIdx: index("survey_questions_sort_idx").on(t.sort),
  }),
);

export const surveyQuestionOptions = pgTable(
  "survey_question_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => surveyQuestions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    questionIdIdx: index("survey_question_options_question_id_idx").on(t.questionId),
    sortIdx: index("survey_question_options_sort_idx").on(t.sort),
  }),
);

export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    surveyIdIdx: index("survey_responses_survey_id_idx").on(t.surveyId),
    userIdIdx: index("survey_responses_user_id_idx").on(t.userId),
    lastSubmitAtIdx: index("survey_responses_updated_at_idx").on(t.updatedAt),
    userUq: uniqueIndex("survey_responses_survey_user_uq").on(t.surveyId, t.userId),
  }),
);

export const surveyResponseItems = pgTable(
  "survey_response_items",
  {
    responseId: uuid("response_id")
      .notNull()
      .references(() => surveyResponses.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => surveyQuestions.id, { onDelete: "restrict" }),
    value: jsonb("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "survey_response_items_pk", columns: [t.responseId, t.questionId] }),
    questionIdIdx: index("survey_response_items_question_id_idx").on(t.questionId),
  }),
);

