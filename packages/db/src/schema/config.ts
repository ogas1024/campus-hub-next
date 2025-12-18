import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const appConfig = pgTable(
  "app_config",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid("updated_by"),
  },
  (t) => ({
    updatedAtIdx: index("app_config_updated_at_idx").on(t.updatedAt),
  }),
);

