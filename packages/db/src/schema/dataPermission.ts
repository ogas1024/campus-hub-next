import { index, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { roles } from "./rbac";
import { departments } from "./users";

export const dataScopeTypeEnum = pgEnum("data_scope_type", [
  "all",
  "custom",
  "dept",
  "dept_and_child",
  "self",
  "none",
]);

export const roleDataScopes = pgTable(
  "role_data_scopes",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    module: text("module").notNull(),
    scopeType: dataScopeTypeEnum("scope_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "role_data_scopes_pk", columns: [t.roleId, t.module] }),
    roleIdIdx: index("role_data_scopes_role_id_idx").on(t.roleId),
    moduleIdx: index("role_data_scopes_module_idx").on(t.module),
  }),
);

export const roleDataScopeDepartments = pgTable(
  "role_data_scope_departments",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    module: text("module").notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({
      name: "role_data_scope_departments_pk",
      columns: [t.roleId, t.module, t.departmentId],
    }),
    roleIdIdx: index("role_data_scope_departments_role_id_idx").on(t.roleId),
    moduleIdx: index("role_data_scope_departments_module_idx").on(t.module),
    departmentIdIdx: index("role_data_scope_departments_department_id_idx").on(t.departmentId),
  }),
);

