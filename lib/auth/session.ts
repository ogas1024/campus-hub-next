import "server-only";

import { eq } from "drizzle-orm";

import { unauthorized } from "@/lib/http/errors";
import { db } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth/types";
import { appConfig, authUsers, profiles } from "@campus-hub/db";

type ProfileStatus = "active" | "disabled" | "banned" | "pending_approval" | "pending_email_verification";

export type UserAccessBlockCode =
  | "NOT_AUTHENTICATED"
  | "PROFILE_MISSING"
  | "EMAIL_NOT_VERIFIED"
  | "PENDING_APPROVAL"
  | "DISABLED"
  | "BANNED"
  | "DELETED";

export type UserAccessInfo = {
  authenticated: boolean;
  allowed: boolean;
  userId?: string;
  email?: string | null;
  profileStatus?: ProfileStatus;
  effectiveProfileStatus?: ProfileStatus;
  emailVerified?: boolean;
  requiresApproval?: boolean;
  banned?: boolean;
  deleted?: boolean;
  blockCode?: UserAccessBlockCode;
};

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return null;
}

async function getRegistrationRequiresApproval(): Promise<boolean> {
  const rows = await db
    .select({ value: appConfig.value })
    .from(appConfig)
    .where(eq(appConfig.key, "registration.requiresApproval"))
    .limit(1);
  return coerceBoolean(rows[0]?.value) ?? false;
}

export async function getUserAccessInfo(): Promise<UserAccessInfo> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { authenticated: false, allowed: false, blockCode: "NOT_AUTHENTICATED" };

  const userId = data.user.id;
  const userEmail = data.user.email ?? null;

  const rows = await db
    .select({
      status: profiles.status,
      emailConfirmedAt: authUsers.emailConfirmedAt,
      bannedUntil: authUsers.bannedUntil,
      deletedAt: authUsers.deletedAt,
    })
    .from(profiles)
    .leftJoin(authUsers, eq(authUsers.id, profiles.id))
    .where(eq(profiles.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { authenticated: true, allowed: false, userId, email: userEmail, blockCode: "PROFILE_MISSING" };
  }

  const now = Date.now();
  const emailVerified = !!row.emailConfirmedAt;
  const isBanned = !!row.bannedUntil && row.bannedUntil.getTime() > now;
  const isDeleted = !!row.deletedAt;

  const profileStatus = row.status as ProfileStatus;
  let requiresApproval: boolean | undefined;
  let effectiveProfileStatus = profileStatus;

  if (profileStatus === "pending_approval" && emailVerified) {
    requiresApproval = await getRegistrationRequiresApproval();
    if (!requiresApproval) effectiveProfileStatus = "active";
  }

  const allowed = emailVerified && !isBanned && !isDeleted && effectiveProfileStatus === "active";

  if (allowed) {
    return {
      authenticated: true,
      allowed: true,
      userId,
      email: userEmail,
      profileStatus,
      effectiveProfileStatus,
      emailVerified,
      requiresApproval,
      banned: false,
      deleted: false,
    };
  }

  let blockCode: UserAccessBlockCode;
  if (!emailVerified) blockCode = "EMAIL_NOT_VERIFIED";
  else if (isDeleted) blockCode = "DELETED";
  else if (isBanned) blockCode = "BANNED";
  else if (effectiveProfileStatus === "pending_approval") blockCode = "PENDING_APPROVAL";
  else if (effectiveProfileStatus === "disabled") blockCode = "DISABLED";
  else if (effectiveProfileStatus === "banned") blockCode = "BANNED";
  else blockCode = "DISABLED";

  return {
    authenticated: true,
    allowed: false,
    userId,
    email: userEmail,
    profileStatus,
    effectiveProfileStatus,
    emailVerified,
    requiresApproval,
    banned: isBanned,
    deleted: isDeleted,
    blockCode,
  };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const info = await getUserAccessInfo();
  if (!info.authenticated || !info.allowed || !info.userId) return null;
  return { id: info.userId, email: info.email ?? null };
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}
