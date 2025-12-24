import { redirect } from "next/navigation";

import { requirePerm } from "@/lib/auth/permissions";

type Params = { params: Promise<{ id: string }> };

export default async function EditNoticePage({ params }: Params) {
  await requirePerm("campus:notice:list");
  const { id } = await params;
  redirect(`/console/notices?dialog=notice-edit&id=${encodeURIComponent(id)}`);
}
