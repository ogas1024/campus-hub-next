import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { parseIntParam, parseTriStateBooleanParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { listPortalNotices } from "@/lib/modules/notices/notices.service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });
    const q = searchParams.get("q") ?? undefined;
    const includeExpired = searchParams.get("includeExpired") === "true";

    const read = parseTriStateBooleanParam(searchParams.get("read"));

    const sortByParam = searchParams.get("sortBy");
    const sortBy =
      sortByParam === "updatedAt" || sortByParam === "expireAt" ? sortByParam : ("publishAt" as const);

    const sortOrderParam = searchParams.get("sortOrder");
    const sortOrder = sortOrderParam === "asc" ? "asc" : "desc";

    const data = await listPortalNotices({
      userId: user.id,
      page,
      pageSize,
      q,
      includeExpired,
      read,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
