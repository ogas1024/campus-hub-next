import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { rejectReservationBodySchema } from "@/lib/modules/facilities/facilities.schemas";
import { rejectReservation } from "@/lib/modules/facilities/facilities.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:facility:review");
    const ctx = getRequestContext(request);
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = rejectReservationBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await rejectReservation({
      actorUserId: user.id,
      reservationId: id,
      reason: parsed.data.reason,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

