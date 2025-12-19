import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError, getRequestContext } from "@/lib/http/route";
import { updateMyReservationBodySchema } from "@/lib/modules/facilities/facilities.schemas";
import { getMyReservationDetail, updateMyReservation } from "@/lib/modules/facilities/facilities.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const data = await getMyReservationDetail({ userId: user.id, reservationId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const ctx = getRequestContext(request);
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = updateMyReservationBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await updateMyReservation({
      userId: user.id,
      reservationId: id,
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

