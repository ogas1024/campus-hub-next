import { requirePortalUser } from "@/lib/auth/guards";
import { LostfoundEditorClient } from "@/components/lostfound/LostfoundEditorClient";

export default async function LostfoundNewPage() {
  await requirePortalUser();
  return <LostfoundEditorClient mode="create" returnHref="/lostfound/me" />;
}

