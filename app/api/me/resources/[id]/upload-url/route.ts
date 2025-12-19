import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { createUploadUrlBodySchema } from "@/lib/modules/course-resources/courseResources.schemas";
import { createMyResourceUploadUrl } from "@/lib/modules/course-resources/courseResources.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = createUploadUrlBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await createMyResourceUploadUrl({ userId: user.id, resourceId: id, ...parsed.data });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

