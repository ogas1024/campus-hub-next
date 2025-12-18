import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { updatePositionBodySchema } from "@/lib/modules/organization/organization.schemas";
import { deletePosition, updatePosition } from "@/lib/modules/organization/organization.service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:position:*");
    const { id } = await params;
    const ctx = getRequestContext(request);

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = updatePositionBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await updatePosition({
      id,
      code: parsed.data.code ?? undefined,
      name: parsed.data.name,
      description: parsed.data.description ?? undefined,
      enabled: parsed.data.enabled,
      sort: parsed.data.sort,
      reason: parsed.data.reason,
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
    const user = await requirePerm("campus:position:*");
    const { id } = await params;
    const ctx = getRequestContext(request);

    const { searchParams } = new URL(request.url);
    const reason = searchParams.get("reason") ?? undefined;

    const data = await deletePosition({
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

