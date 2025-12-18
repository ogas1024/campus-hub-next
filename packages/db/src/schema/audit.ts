import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid("actor_user_id").notNull(),
    actorEmail: text("actor_email"),
    actorRoles: jsonb("actor_roles"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    success: boolean("success").notNull().default(true),
    errorCode: text("error_code"),
    reason: text("reason"),
    diff: jsonb("diff"),
    requestId: text("request_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => ({
    occurredAtIdx: index("audit_logs_occurred_at_idx").on(t.occurredAt),
    actorUserIdIdx: index("audit_logs_actor_user_id_idx").on(t.actorUserId),
    actionIdx: index("audit_logs_action_idx").on(t.action),
    targetIdx: index("audit_logs_target_idx").on(t.targetType, t.targetId),
  }),
);

