import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { setMajorLeadsBodySchema } from "@/lib/modules/course-resources/courseResources.schemas";
import { listConsoleMajorLeads, setConsoleMajorLeads } from "@/lib/modules/course-resources/courseResources.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:resource:major_list");
    const { id } = await params;
    const data = await listConsoleMajorLeads({ majorId: id, actorUserId: user.id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:resource:major_lead_update");
    const ctx = getRequestContext(request);
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = setMajorLeadsBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await setConsoleMajorLeads({
      majorId: id,
      userIds: parsed.data.userIds,
      actor: { userId: user.id, email: user.email },
      request: ctx,
      reason: parsed.data.reason,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
