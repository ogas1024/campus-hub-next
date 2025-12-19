import { redirect } from "next/navigation";

import { hasAnyPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { consoleEntryPermCodes } from "@/lib/navigation/modules";

export default async function ConsoleIndexPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const canEnterConsole = await hasAnyPerm(user.id, [...consoleEntryPermCodes]);
  if (canEnterConsole) redirect("/console/workbench");

  redirect("/notices");
}
