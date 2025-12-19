import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { createFacilityBanBodySchema } from "@/lib/modules/facilities/facilities.schemas";
import { createConsoleBan, listConsoleBans } from "@/lib/modules/facilities/facilities.service";

export async function GET() {
  try {
    const user = await requirePerm("campus:facility:ban");
    const data = await listConsoleBans({ actorUserId: user.id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePerm("campus:facility:ban");
    const ctx = getRequestContext(request);

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = createFacilityBanBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await createConsoleBan({
      actorUserId: user.id,
      userId: parsed.data.userId,
      duration: parsed.data.duration,
      expiresAt: parsed.data.expiresAt,
      reason: parsed.data.reason,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

