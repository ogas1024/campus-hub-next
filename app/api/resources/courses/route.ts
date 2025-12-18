import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { listPortalCourses } from "@/lib/modules/course-resources/courseResources.service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const majorId = searchParams.get("majorId");
    if (!majorId) throw badRequest("majorId 必填");

    const data = await listPortalCourses({ userId: user.id, majorId });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

