import { hasPerm, requirePerm } from "@/lib/auth/permissions";

import VoteResultsClient from "./VoteResultsClient";

type Params = { params: Promise<{ id: string }> };

export default async function ConsoleVoteResultsPage({ params }: Params) {
  const user = await requirePerm("campus:vote:read");
  const { id } = await params;

  const canUpdate = await hasPerm(user.id, "campus:vote:update");

  return <VoteResultsClient voteId={id} perms={{ canUpdate }} />;
}

