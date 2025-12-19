import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { parseIntParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { getUserLeaderboard } from "@/lib/modules/facilities/facilities.service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const days = parseIntParam(searchParams.get("days"), { defaultValue: 30, min: 1, max: 30 });
    if (![7, 30].includes(days)) throw badRequest("days 仅支持 7 或 30");

    const data = await getUserLeaderboard({ userId: user.id, days });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

