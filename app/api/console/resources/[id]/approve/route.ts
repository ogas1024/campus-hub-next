import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { reviewApproveBodySchema } from "@/lib/modules/course-resources/courseResources.schemas";
import { approveConsoleResource } from "@/lib/modules/course-resources/courseResources.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:resource:review");
    const ctx = getRequestContext(request);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = reviewApproveBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await approveConsoleResource({
      resourceId: id,
      comment: parsed.data.comment,
      actor: { userId: user.id, email: user.email },
      request: ctx,
      reason: parsed.data.reason,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

