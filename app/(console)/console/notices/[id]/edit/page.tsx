import { hasPerm, requirePerm } from "@/lib/auth/permissions";

import EditNoticeClient from "./EditNoticeClient";

type Params = { params: Promise<{ id: string }> };

export default async function EditNoticePage({ params }: Params) {
  const user = await requirePerm("campus:notice:list");
  const { id } = await params;

  const [canUpdate, canDelete, canPin, canPublish, canManageAll, canAuditList] = await Promise.all([
    hasPerm(user.id, "campus:notice:update"),
    hasPerm(user.id, "campus:notice:delete"),
    hasPerm(user.id, "campus:notice:pin"),
    hasPerm(user.id, "campus:notice:publish"),
    hasPerm(user.id, "campus:notice:manage"),
    hasPerm(user.id, "campus:audit:list"),
  ]);

  return (
    <EditNoticeClient
      noticeId={id}
      currentUserId={user.id}
      perms={{ canUpdate, canDelete, canPin, canPublish, canManageAll, canAuditList }}
    />
  );
}
