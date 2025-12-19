import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { updateCourseBodySchema } from "@/lib/modules/course-resources/courseResources.schemas";
import { deleteConsoleCourse, updateConsoleCourse } from "@/lib/modules/course-resources/courseResources.service";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:resource:course_update");
    const ctx = getRequestContext(request);
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = updateCourseBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await updateConsoleCourse({
      courseId: id,
      patch: {
        majorId: parsed.data.majorId,
        name: parsed.data.name,
        code: typeof parsed.data.code === "undefined" ? undefined : parsed.data.code,
        enabled: parsed.data.enabled,
        sort: parsed.data.sort,
        remark: typeof parsed.data.remark === "undefined" ? undefined : parsed.data.remark,
      },
      actor: { userId: user.id, email: user.email },
      request: ctx,
      reason: parsed.data.reason,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:resource:course_delete");
    const ctx = getRequestContext(request);
    const { id } = await params;

    const reason = new URL(request.url).searchParams.get("reason") ?? undefined;
    const data = await deleteConsoleCourse({
      courseId: id,
      actor: { userId: user.id, email: user.email },
      request: ctx,
      reason: reason?.trim() ? reason.trim() : undefined,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
