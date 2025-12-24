import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export default async function MaterialDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  redirect(`/materials?dialog=material-submit&id=${encodeURIComponent(id)}`);
}
