import { hasPerm, requirePerm } from "@/lib/auth/permissions";

import EditVoteClient from "./EditVoteClient";

type Params = { params: Promise<{ id: string }> };

export default async function ConsoleVoteEditPage({ params }: Params) {
  const user = await requirePerm("campus:vote:read");
  const { id } = await params;

  const [canUpdate, canPublish, canClose, canExtend, canPin, canArchive] = await Promise.all([
    hasPerm(user.id, "campus:vote:update"),
    hasPerm(user.id, "campus:vote:publish"),
    hasPerm(user.id, "campus:vote:close"),
    hasPerm(user.id, "campus:vote:extend"),
    hasPerm(user.id, "campus:vote:pin"),
    hasPerm(user.id, "campus:vote:archive"),
  ]);

  return <EditVoteClient voteId={id} perms={{ canUpdate, canPublish, canClose, canExtend, canPin, canArchive }} />;
}

