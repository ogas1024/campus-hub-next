"use server";

import { cookies } from "next/headers";

import {
  PORTAL_HOME_PREFERENCES_COOKIE_NAME,
  WORKBENCH_PREFERENCES_COOKIE_NAME,
  normalizePortalHomePreferences,
  normalizeWorkbenchPreferences,
} from "@/lib/workbench/preferences";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2; // 2 年

function getCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
  };
}

export async function saveWorkbenchPreferences(input: unknown) {
  const normalized = normalizeWorkbenchPreferences(input);
  const store = await cookies();
  store.set(WORKBENCH_PREFERENCES_COOKIE_NAME, JSON.stringify(normalized), getCookieOptions());
  return { ok: true as const };
}

export async function resetWorkbenchPreferences() {
  const store = await cookies();
  store.delete(WORKBENCH_PREFERENCES_COOKIE_NAME);
  return { ok: true as const };
}

export async function savePortalHomePreferences(input: unknown) {
  const normalized = normalizePortalHomePreferences(input);
  const store = await cookies();
  store.set(PORTAL_HOME_PREFERENCES_COOKIE_NAME, JSON.stringify(normalized), getCookieOptions());
  return { ok: true as const };
}

export async function resetPortalHomePreferences() {
  const store = await cookies();
  store.delete(PORTAL_HOME_PREFERENCES_COOKIE_NAME);
  return { ok: true as const };
}

