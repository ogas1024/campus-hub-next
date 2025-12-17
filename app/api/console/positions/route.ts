import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { createPositionBodySchema } from "@/lib/modules/organization/organization.schemas";
import { createPosition, listPositions } from "@/lib/modules/organization/organization.service";

export async function GET() {
  try {
    await requirePerm("campus:position:*");
    const data = await listPositions();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePerm("campus:position:*");
    const ctx = getRequestContext(request);

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = createPositionBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const id = await createPosition({
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description,
      enabled: parsed.data.enabled,
      sort: parsed.data.sort,
      reason: parsed.data.reason,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

