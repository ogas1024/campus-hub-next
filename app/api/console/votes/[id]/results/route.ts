import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { getVoteResults } from "@/lib/modules/votes/votes.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:vote:read");
    const { id } = await params;
    const data = await getVoteResults({ actorUserId: user.id, voteId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

