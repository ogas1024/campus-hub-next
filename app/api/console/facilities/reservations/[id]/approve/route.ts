import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { approveReservation } from "@/lib/modules/facilities/facilities.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:facility:review");
    const ctx = getRequestContext(request);
    const { id } = await params;

    const data = await approveReservation({
      actorUserId: user.id,
      reservationId: id,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

