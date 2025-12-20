import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { findConsoleMaterialByNoticeId } from "@/lib/modules/materials/materials.service";

import EditNoticeClient from "./EditNoticeClient";

type Params = { params: Promise<{ id: string }> };

export default async function EditNoticePage({ params }: Params) {
  const user = await requirePerm("campus:notice:list");
  const { id } = await params;

  const [
    canUpdate,
    canDelete,
    canPin,
    canPublish,
    canManageAll,
    canAuditList,
    canMaterialCreate,
    canMaterialRead,
    canMaterialProcess,
  ] = await Promise.all([
    hasPerm(user.id, "campus:notice:update"),
    hasPerm(user.id, "campus:notice:delete"),
    hasPerm(user.id, "campus:notice:pin"),
    hasPerm(user.id, "campus:notice:publish"),
    hasPerm(user.id, "campus:notice:manage"),
    hasPerm(user.id, "campus:audit:list"),
    hasPerm(user.id, "campus:material:create"),
    hasPerm(user.id, "campus:material:read"),
    hasPerm(user.id, "campus:material:process"),
  ]);

  const material = canMaterialRead ? await findConsoleMaterialByNoticeId({ actorUserId: user.id, noticeId: id }).catch(() => null) : null;

  return (
    <EditNoticeClient
      noticeId={id}
      currentUserId={user.id}
      perms={{ canUpdate, canDelete, canPin, canPublish, canManageAll, canAuditList }}
      materials={{
        canCreate: canMaterialCreate,
        canRead: canMaterialRead,
        canProcess: canMaterialProcess,
        linked: material
          ? {
              id: material.id,
              title: material.title,
              status: material.status,
              dueAt: material.dueAt ? material.dueAt.toISOString() : null,
              archivedAt: material.archivedAt ? material.archivedAt.toISOString() : null,
            }
          : null,
      }}
    />
  );
}
