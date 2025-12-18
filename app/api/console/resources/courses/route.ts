import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { createCourseBodySchema } from "@/lib/modules/course-resources/courseResources.schemas";
import { createConsoleCourse, listConsoleCourses } from "@/lib/modules/course-resources/courseResources.service";

export async function GET(request: Request) {
  try {
    const user = await requirePerm("campus:resource:course_list");
    const { searchParams } = new URL(request.url);
    const majorId = searchParams.get("majorId") ?? undefined;

    const data = await listConsoleCourses({ actorUserId: user.id, majorId });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePerm("campus:resource:course_create");
    const ctx = getRequestContext(request);

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = createCourseBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await createConsoleCourse({
      ...parsed.data,
      actor: { userId: user.id, email: user.email },
      request: ctx,
      reason: parsed.data.reason,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

