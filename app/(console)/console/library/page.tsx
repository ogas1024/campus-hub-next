import { redirect } from "next/navigation";

import { hasPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function ConsoleLibraryIndexPage() {
  const user = await requireUser();

  if (await hasPerm(user.id, "campus:library:review")) {
    redirect("/console/library/pending");
  }
  if (await hasPerm(user.id, "campus:library:list")) {
    redirect("/console/library/published");
  }

  redirect("/console");
}

