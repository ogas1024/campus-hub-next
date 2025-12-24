import { redirect } from "next/navigation";

import { requirePerm } from "@/lib/auth/permissions";

export default async function ConsoleRoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("campus:role:*");
  const { id } = await params;
  redirect(`/console/roles?dialog=role-edit&id=${encodeURIComponent(id)}`);
}
