import { redirect } from "next/navigation";

import { hasPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { consoleModules } from "@/lib/navigation/modules";

export default async function ConsoleIndexPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  for (const m of consoleModules) {
    if (await hasPerm(user.id, m.permCode)) redirect(m.href);
  }

  redirect("/notices");
}
