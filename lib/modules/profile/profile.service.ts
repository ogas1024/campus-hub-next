import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/http/errors";
import { authUsers, profiles } from "@campus-hub/db";

export type MyProfile = {
  id: string;
  email: string | null;
  name: string;
  username: string | null;
  studentId: string;
  avatarUrl: string | null;
  status: "active" | "disabled" | "banned" | "pending_approval" | "pending_email_verification";
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

export async function getMyProfile(userId: string): Promise<MyProfile> {
  const rows = await db
    .select({
      id: profiles.id,
      email: authUsers.email,
      name: profiles.name,
      username: profiles.username,
      studentId: profiles.studentId,
      avatarUrl: profiles.avatarUrl,
      status: profiles.status,
      createdAt: profiles.createdAt,
      updatedAt: profiles.updatedAt,
      lastLoginAt: profiles.lastLoginAt,
    })
    .from(profiles)
    .innerJoin(authUsers, eq(authUsers.id, profiles.id))
    .where(eq(profiles.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound("用户资料不存在");

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    username: row.username,
    studentId: row.studentId,
    avatarUrl: row.avatarUrl,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt,
  };
}

type ProfilePatch = { name?: string; username?: string | null; avatarUrl?: string | null };

async function updateProfilePatch(params: { userId: string; patch: ProfilePatch }): Promise<MyProfile> {
  const patch: ProfilePatch = {};
  if (typeof params.patch.name !== "undefined") patch.name = params.patch.name;
  if (typeof params.patch.username !== "undefined") patch.username = params.patch.username;
  if (typeof params.patch.avatarUrl !== "undefined") patch.avatarUrl = params.patch.avatarUrl;

  try {
    await db.update(profiles).set(patch).where(eq(profiles.id, params.userId));
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") throw conflict("用户名已被占用");
    throw err;
  }

  return getMyProfile(params.userId);
}

export async function updateMyProfileBasics(params: {
  userId: string;
  patch: { name?: string; username?: string | null };
}): Promise<MyProfile> {
  return updateProfilePatch({ userId: params.userId, patch: params.patch });
}

export async function setMyAvatarUrl(params: { userId: string; avatarUrl: string | null }): Promise<MyProfile> {
  return updateProfilePatch({ userId: params.userId, patch: { avatarUrl: params.avatarUrl } });
}
