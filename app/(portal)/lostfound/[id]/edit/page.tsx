import { redirect } from "next/navigation";

import { LostfoundEditorClient } from "@/components/lostfound/LostfoundEditorClient";
import { requirePortalUser } from "@/lib/auth/guards";
import { getMyLostfoundDetail } from "@/lib/modules/lostfound/lostfound.service";

type Params = { params: Promise<{ id: string }> };

export default async function LostfoundEditPage({ params }: Params) {
  const user = await requirePortalUser();
  const { id } = await params;

  const data = await getMyLostfoundDetail({ userId: user.id, itemId: id });
  if (data.solvedAt) redirect("/lostfound/me");

  return (
    <LostfoundEditorClient
      mode="edit"
      itemId={data.id}
      initial={{
        type: data.type,
        title: data.title,
        content: data.content,
        location: data.location,
        occurredAt: data.occurredAt ? data.occurredAt.toISOString() : null,
        contactInfo: data.contactInfo,
        images: data.images,
      }}
      returnHref="/lostfound/me"
    />
  );
}

