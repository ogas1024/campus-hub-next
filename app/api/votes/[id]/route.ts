import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { getPortalVoteDetail } from "@/lib/modules/votes/votes.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const data = await getPortalVoteDetail({ userId: user.id, voteId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

