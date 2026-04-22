import { boolean, foreignKey, index, integer, text, timestamp, uniqueIndex, pgTable } from "drizzle-orm/pg-core";

export const appModules = pgTable(
  "app_modules",
  {
    code: text("code").primaryKey(),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    remark: text("remark"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameUq: uniqueIndex("app_modules_name_uq").on(t.name),
    enabledIdx: index("app_modules_enabled_idx").on(t.enabled),
    sortIdx: index("app_modules_sort_idx").on(t.sort),
  }),
);

export const dataScopeModules = pgTable(
  "data_scope_modules",
  {
    moduleCode: text("module_code").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    moduleCodeFk: foreignKey({
      name: "data_scope_modules_module_code_fk",
      columns: [t.moduleCode],
      foreignColumns: [appModules.code],
    }).onDelete("restrict"),
  }),
);
