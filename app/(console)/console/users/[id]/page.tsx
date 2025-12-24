import { redirect } from "next/navigation";

import { requirePerm } from "@/lib/auth/permissions";

export default async function ConsoleUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("campus:user:read");
  const { id } = await params;
  redirect(`/console/users?dialog=user-edit&id=${encodeURIComponent(id)}`);
}
