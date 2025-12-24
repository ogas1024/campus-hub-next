import { redirect } from "next/navigation";

import { requirePortalUser } from "@/lib/auth/guards";
import { getMyLostfoundDetail } from "@/lib/modules/lostfound/lostfound.service";

type Params = { params: Promise<{ id: string }> };

export default async function LostfoundEditPage({ params }: Params) {
  const user = await requirePortalUser();
  const { id } = await params;

  const data = await getMyLostfoundDetail({ userId: user.id, itemId: id });
  if (data.solvedAt) redirect("/lostfound/me");

  redirect(`/lostfound/me?dialog=lostfound-edit&id=${encodeURIComponent(data.id)}`);
}
