import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { listPortalNotices } from "@/lib/modules/notices/notices.service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
    const q = searchParams.get("q") ?? undefined;
    const includeExpired = searchParams.get("includeExpired") === "true";

    const readParam = searchParams.get("read");
    const read = readParam === "true" ? true : readParam === "false" ? false : undefined;

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
