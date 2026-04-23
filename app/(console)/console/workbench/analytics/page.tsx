import { redirect } from "next/navigation";

import { WorkbenchAnalyticsClient } from "@/components/console/workbench/analytics/WorkbenchAnalyticsClient";
import { requireUser } from "@/lib/auth/session";
import { resolveConsoleLandingHref } from "@/lib/navigation/consoleLanding";
import { readWorkbenchAnalyticsPreferences } from "@/lib/workbench/preferences.server";

export default async function ConsoleWorkbenchAnalyticsPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const landingHref = await resolveConsoleLandingHref(user.id);
  if (!landingHref) redirect("/notices");

  const preferences = await readWorkbenchAnalyticsPreferences();

  return <WorkbenchAnalyticsClient initialPreferences={preferences} />;
}
