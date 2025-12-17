import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    parentId: uuid("parent_id"),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    parentIdIdx: index("departments_parent_id_idx").on(t.parentId),
    parentIdFk: foreignKey({
      name: "departments_parent_id_fk",
      columns: [t.parentId],
      foreignColumns: [t.id],
    }).onDelete("restrict"),
  }),
);

export const departmentClosure = pgTable(
  "department_closure",
  {
    ancestorId: uuid("ancestor_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    descendantId: uuid("descendant_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    depth: integer("depth").notNull(),
  },
  (t) => ({
    pk: primaryKey({ name: "department_closure_pk", columns: [t.ancestorId, t.descendantId] }),
    ancestorIdIdx: index("department_closure_ancestor_id_idx").on(t.ancestorId),
    descendantIdIdx: index("department_closure_descendant_id_idx").on(t.descendantId),
  }),
);

export const userDepartments = pgTable(
  "user_departments",
  {
    userId: uuid("user_id").notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "user_departments_pk", columns: [t.userId, t.departmentId] }),
    userIdIdx: index("user_departments_user_id_idx").on(t.userId),
    departmentIdIdx: index("user_departments_department_id_idx").on(t.departmentId),
  }),
);

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code"),
    name: text("name").notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeUq: uniqueIndex("positions_code_uq").on(t.code),
    nameUq: uniqueIndex("positions_name_uq").on(t.name),
  }),
);

export const userPositions = pgTable(
  "user_positions",
  {
    userId: uuid("user_id").notNull(),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "user_positions_pk", columns: [t.userId, t.positionId] }),
    userIdIdx: index("user_positions_user_id_idx").on(t.userId),
  }),
);
