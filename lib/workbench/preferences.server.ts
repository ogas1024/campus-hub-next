import "server-only";

import { cookies } from "next/headers";

import {
  PORTAL_HOME_PREFERENCES_COOKIE_NAME,
  WORKBENCH_PREFERENCES_COOKIE_NAME,
  WORKBENCH_ANALYTICS_PREFERENCES_COOKIE_NAME,
  defaultPortalHomePreferences,
  defaultWorkbenchAnalyticsPreferences,
  defaultWorkbenchPreferences,
  normalizePortalHomePreferences,
  normalizeWorkbenchAnalyticsPreferences,
  normalizeWorkbenchPreferences,
} from "@/lib/workbench/preferences";

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function readWorkbenchPreferences() {
  const store = await cookies();
  const raw = store.get(WORKBENCH_PREFERENCES_COOKIE_NAME)?.value ?? "";
  if (!raw) return defaultWorkbenchPreferences;
  return normalizeWorkbenchPreferences(parseJson(raw));
}

export async function readWorkbenchAnalyticsPreferences() {
  const store = await cookies();
  const raw = store.get(WORKBENCH_ANALYTICS_PREFERENCES_COOKIE_NAME)?.value ?? "";
  if (!raw) return defaultWorkbenchAnalyticsPreferences;
  return normalizeWorkbenchAnalyticsPreferences(parseJson(raw));
}

export async function readPortalHomePreferences() {
  const store = await cookies();
  const raw = store.get(PORTAL_HOME_PREFERENCES_COOKIE_NAME)?.value ?? "";
  if (!raw) return defaultPortalHomePreferences;
  return normalizePortalHomePreferences(parseJson(raw));
}
