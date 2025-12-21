import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { getPortalLibraryBookDownloadLeaderboard } from "@/lib/modules/library/library.service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const daysRaw = searchParams.get("days");
    const days =
      daysRaw == null || daysRaw === ""
        ? undefined
        : (() => {
            const n = Number(daysRaw);
            if (!Number.isFinite(n)) throw badRequest("days 必须为数字");
            return Math.trunc(n);
          })();

    const data = await getPortalLibraryBookDownloadLeaderboard({ userId: user.id, days });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

