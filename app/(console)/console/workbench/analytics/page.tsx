import { redirect } from "next/navigation";

import { WorkbenchAnalyticsClient } from "@/components/console/workbench/analytics/WorkbenchAnalyticsClient";
import { hasAnyPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { consoleEntryPermCodes } from "@/lib/navigation/modules";
import { readWorkbenchAnalyticsPreferences } from "@/lib/workbench/preferences.server";

export default async function ConsoleWorkbenchAnalyticsPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const canEnterConsole = await hasAnyPerm(user.id, [...consoleEntryPermCodes]);
  if (!canEnterConsole) redirect("/notices");

  const preferences = await readWorkbenchAnalyticsPreferences();

  return <WorkbenchAnalyticsClient initialPreferences={preferences} />;
}

