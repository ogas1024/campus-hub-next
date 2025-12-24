import { redirect } from "next/navigation";

import { WorkbenchAnalyticsScreenClient } from "@/components/console/workbench/analytics/WorkbenchAnalyticsScreenClient";
import { hasAnyPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { consoleEntryPermCodes } from "@/lib/navigation/modules";
import { parseAnalyticsDaysParam } from "@/lib/modules/analytics/analytics.service";
import { readWorkbenchAnalyticsPreferences } from "@/lib/workbench/preferences.server";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.length > 0 ? value[0] ?? null : null;
}

export default async function ScreenWorkbenchAnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const canEnterConsole = await hasAnyPerm(user.id, [...consoleEntryPermCodes]);
  if (!canEnterConsole) redirect("/notices");

  const sp = await searchParams;
  const days = parseAnalyticsDaysParam(pickString(sp.days), { defaultValue: 30 });
  const preferences = await readWorkbenchAnalyticsPreferences();

  return <WorkbenchAnalyticsScreenClient initialPreferences={preferences} initialDays={days} />;
}

