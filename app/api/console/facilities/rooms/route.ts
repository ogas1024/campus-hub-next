import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { createRoomBodySchema } from "@/lib/modules/facilities/facilities.schemas";
import { createConsoleRoom, listConsoleRooms } from "@/lib/modules/facilities/facilities.service";

export async function GET(request: Request) {
  try {
    await requirePerm("campus:facility:*");
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get("buildingId") ?? undefined;

    const floorNoRaw = searchParams.get("floorNo");
    let floorNo: number | undefined;
    if (floorNoRaw != null) {
      const parsed = Number(floorNoRaw);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) throw badRequest("floorNo 必须为整数");
      floorNo = parsed;
    }

    const data = await listConsoleRooms({ buildingId, floorNo });
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
    const parsed = createRoomBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await createConsoleRoom({
      actorUserId: user.id,
      buildingId: parsed.data.buildingId,
      floorNo: parsed.data.floorNo,
      name: parsed.data.name,
      capacity: parsed.data.capacity ?? null,
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
