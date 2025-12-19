import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { parseIntParam } from "@/lib/http/query";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { createMyReservationBodySchema } from "@/lib/modules/facilities/facilities.schemas";
import { createMyReservation, listMyReservations } from "@/lib/modules/facilities/facilities.service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });
    const status = (searchParams.get("status") ?? undefined) as "pending" | "approved" | "rejected" | "cancelled" | undefined;
    if (status && !["pending", "approved", "rejected", "cancelled"].includes(status)) throw badRequest("status 无效");

    const data = await listMyReservations({ userId: user.id, page, pageSize, status });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ctx = getRequestContext(request);

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = createMyReservationBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await createMyReservation({
      userId: user.id,
      roomId: parsed.data.roomId,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      purpose: parsed.data.purpose,
      participantUserIds: parsed.data.participantUserIds,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

