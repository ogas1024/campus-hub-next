import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { parseIntParam, parseTriStateBooleanParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { listPortalUserWorks } from "@/lib/modules/course-resources/courseResources.service";

type Params = { params: Promise<{ userId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { userId } = await params;
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });
    const q = searchParams.get("q") ?? undefined;
    const majorId = searchParams.get("majorId") ?? undefined;
    const courseId = searchParams.get("courseId") ?? undefined;
    const best = parseTriStateBooleanParam(searchParams.get("best"));

    const sortByParam = searchParams.get("sortBy");
    const sortBy = sortByParam === "publishedAt" ? "publishedAt" : ("downloadCount" as const);
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : ("desc" as const);

    const data = await listPortalUserWorks({
      userId: user.id,
      targetUserId: userId,
      majorId,
      courseId,
      q,
      best,
      sortBy,
      sortOrder,
      page,
      pageSize,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

