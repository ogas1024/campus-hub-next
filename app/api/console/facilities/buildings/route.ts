import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { createBuildingBodySchema } from "@/lib/modules/facilities/facilities.schemas";
import { createConsoleBuilding, listConsoleBuildings } from "@/lib/modules/facilities/facilities.service";

export async function GET() {
  try {
    await requirePerm("campus:facility:*");
    const data = await listConsoleBuildings();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePerm("campus:facility:*");
    const ctx = getRequestContext(request);

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = createBuildingBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await createConsoleBuilding({
      actorUserId: user.id,
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      sort: parsed.data.sort,
      remark: parsed.data.remark,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

