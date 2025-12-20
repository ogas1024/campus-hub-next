import { hasPerm, requirePerm } from "@/lib/auth/permissions";

import EditMaterialClient from "./EditMaterialClient";

type Params = { params: Promise<{ id: string }> };

export default async function ConsoleMaterialEditPage({ params }: Params) {
  const user = await requirePerm("campus:material:read");
  const { id } = await params;

  const [canUpdate, canDelete, canPublish, canClose, canArchive, canProcess, canManageAll] = await Promise.all([
    hasPerm(user.id, "campus:material:update"),
    hasPerm(user.id, "campus:material:delete"),
    hasPerm(user.id, "campus:material:publish"),
    hasPerm(user.id, "campus:material:close"),
    hasPerm(user.id, "campus:material:archive"),
    hasPerm(user.id, "campus:material:process"),
    hasPerm(user.id, "campus:material:manage"),
  ]);

  return (
    <EditMaterialClient
      materialId={id}
      currentUserId={user.id}
      perms={{ canUpdate, canDelete, canPublish, canClose, canArchive, canProcess, canManageAll }}
    />
  );
}
