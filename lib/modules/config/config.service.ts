import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import type { AuditActor } from "@/lib/modules/audit/audit.service";
import { writeAuditLog } from "@/lib/modules/audit/audit.service";
import type { RequestContext } from "@/lib/http/route";
import { appConfig } from "@campus-hub/db";

const REGISTRATION_APPROVAL_KEY = "registration.requiresApproval";

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return null;
}

export async function getRegistrationConfig() {
  const rows = await db
    .select({ value: appConfig.value })
    .from(appConfig)
    .where(eq(appConfig.key, REGISTRATION_APPROVAL_KEY))
    .limit(1);

  const raw = rows[0]?.value;
  const parsed = coerceBoolean(raw);
  return { requiresApproval: parsed ?? false };
}

export async function setRegistrationConfig(params: {
  requiresApproval: boolean;
  reason?: string;
  actor: AuditActor;
  request: RequestContext;
}) {
  const before = await getRegistrationConfig();

  await db
    .insert(appConfig)
    .values({
      key: REGISTRATION_APPROVAL_KEY,
      value: params.requiresApproval,
      updatedBy: params.actor.userId,
    })
    .onConflictDoUpdate({
      target: appConfig.key,
      set: {
        value: params.requiresApproval,
        updatedBy: params.actor.userId,
      },
    });

  await writeAuditLog({
    actor: params.actor,
    action: "config.registration.update",
    targetType: "config",
    targetId: REGISTRATION_APPROVAL_KEY,
    success: true,
    reason: params.reason,
    diff: { before, after: { requiresApproval: params.requiresApproval } },
    request: params.request,
  });

  return { requiresApproval: params.requiresApproval };
}
