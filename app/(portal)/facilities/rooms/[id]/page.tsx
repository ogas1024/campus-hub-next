import { redirect } from "next/navigation";

import { FacilityRoomTimelineClient } from "@/components/facilities/FacilityRoomTimelineClient";
import { getCurrentUser } from "@/lib/auth/session";

export default async function FacilityRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  return <FacilityRoomTimelineClient userId={user.id} roomId={id} />;
}
