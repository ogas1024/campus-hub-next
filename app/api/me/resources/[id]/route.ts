import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { updateMyResourceBodySchema } from "@/lib/modules/course-resources/courseResources.schemas";
import { deleteMyResource, getMyResourceDetail, updateMyResource } from "@/lib/modules/course-resources/courseResources.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const data = await getMyResourceDetail({ userId: user.id, resourceId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = updateMyResourceBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await updateMyResource({ userId: user.id, resourceId: id, patch: parsed.data });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const data = await deleteMyResource({ userId: user.id, resourceId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

