import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { revokeFacilityBanBodySchema } from "@/lib/modules/facilities/facilities.schemas";
import { revokeConsoleBan } from "@/lib/modules/facilities/facilities.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:facility:ban");
    const ctx = getRequestContext(request);
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = revokeFacilityBanBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await revokeConsoleBan({
      actorUserId: user.id,
      banId: id,
      reason: parsed.data.reason,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

