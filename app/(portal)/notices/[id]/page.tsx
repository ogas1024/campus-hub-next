import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export default async function NoticeDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  redirect(`/notices?dialog=notice-view&id=${encodeURIComponent(id)}`);
}
