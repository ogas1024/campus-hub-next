import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { resolveConsoleLandingHref } from "@/lib/navigation/consoleLanding";

export default async function ConsoleIndexPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const landingHref = await resolveConsoleLandingHref(user.id);
  if (landingHref) redirect(landingHref);

  redirect("/notices");
}
