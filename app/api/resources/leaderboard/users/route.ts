import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { getPortalUserScoreLeaderboard } from "@/lib/modules/course-resources/courseResources.service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const majorId = searchParams.get("majorId") ?? undefined;

    const data = await getPortalUserScoreLeaderboard({ userId: user.id, majorId });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

