import { requirePortalUser } from "@/lib/auth/guards";
import { redirect } from "next/navigation";

export default async function LostfoundNewPage() {
  await requirePortalUser();
  redirect("/lostfound?dialog=lostfound-create");
}
