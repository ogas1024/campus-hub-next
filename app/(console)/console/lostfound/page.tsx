import { redirect } from "next/navigation";

import { hasPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function ConsoleLostfoundIndexPage() {
  const user = await requireUser();

  if (await hasPerm(user.id, "campus:lostfound:review")) {
    redirect("/console/lostfound/pending");
  }
  if (await hasPerm(user.id, "campus:lostfound:list")) {
    redirect("/console/lostfound/published");
  }

  redirect("/console");
}

