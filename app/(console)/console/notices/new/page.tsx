import { redirect } from "next/navigation";

import { requirePerm } from "@/lib/auth/permissions";

export default async function NewNoticePage() {
  await requirePerm("campus:notice:create");
  redirect("/console/notices?dialog=notice-create");
}

