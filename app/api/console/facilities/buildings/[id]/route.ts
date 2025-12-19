import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { updateBuildingBodySchema } from "@/lib/modules/facilities/facilities.schemas";
import { deleteConsoleBuilding, updateConsoleBuilding } from "@/lib/modules/facilities/facilities.service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:facility:*");
    const ctx = getRequestContext(request);
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = updateBuildingBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await updateConsoleBuilding({
      actorUserId: user.id,
      id,
      patch: parsed.data,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:facility:*");
    const ctx = getRequestContext(request);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get("reason") ?? undefined;

    const data = await deleteConsoleBuilding({
      actorUserId: user.id,
      id,
      reason,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
