import { redirect } from "next/navigation";

import { hasPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function ConsoleResourcesIndexPage() {
  const user = await requireUser();

  if (await hasPerm(user.id, "campus:resource:review")) {
    redirect("/console/resources/pending");
  }
  if (await hasPerm(user.id, "campus:resource:list")) {
    redirect("/console/resources/published");
  }
  if (await hasPerm(user.id, "campus:resource:major_list")) {
    redirect("/console/resources/majors");
  }
  if (await hasPerm(user.id, "campus:resource:course_list")) {
    redirect("/console/resources/courses");
  }

  redirect("/console");
}
