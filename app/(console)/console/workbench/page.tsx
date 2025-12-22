import { redirect } from "next/navigation";

import { WorkbenchClient } from "@/components/console/workbench/WorkbenchClient";
import { requireUser } from "@/lib/auth/session";
import { consoleEntryPermCodes } from "@/lib/navigation/modules";
import { createWorkbenchContext } from "@/lib/workbench/context";
import { readWorkbenchPreferences } from "@/lib/workbench/preferences.server";
import { collectWorkbenchContributions } from "@/lib/workbench/registry";

export default async function ConsoleWorkbenchPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const preferences = await readWorkbenchPreferences();
  const ctx = createWorkbenchContext({ actorUserId: user.id, settings: { reminderWindowDays: preferences.reminderWindowDays } });

  const canEnterConsole = await ctx.canAnyPerm([...consoleEntryPermCodes]);
  if (!canEnterConsole) redirect("/notices");

  const { cards, quickLinks } = await collectWorkbenchContributions(ctx);

  return <WorkbenchClient cards={cards} quickLinks={quickLinks} initialPreferences={preferences} />;
}
