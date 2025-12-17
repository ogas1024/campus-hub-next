import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const profileStatusEnum = pgEnum("profile_status", [
  "active",
  "disabled",
  "banned",
  "pending_approval",
  "pending_email_verification",
]);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    username: text("username"),
    studentId: text("student_id").notNull(),
    avatarUrl: text("avatar_url"),
    status: profileStatusEnum("status").notNull().default("pending_email_verification"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    usernameUq: uniqueIndex("profiles_username_uq").on(t.username),
    studentIdUq: uniqueIndex("profiles_student_id_uq").on(t.studentId),
    statusIdx: index("profiles_status_idx").on(t.status),
  }),
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeUq: uniqueIndex("roles_code_uq").on(t.code),
  }),
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeUq: uniqueIndex("permissions_code_uq").on(t.code),
  }),
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "user_roles_pk", columns: [t.userId, t.roleId] }),
    userIdIdx: index("user_roles_user_id_idx").on(t.userId),
  }),
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ name: "role_permissions_pk", columns: [t.roleId, t.permissionId] }),
    roleIdIdx: index("role_permissions_role_id_idx").on(t.roleId),
  }),
);
