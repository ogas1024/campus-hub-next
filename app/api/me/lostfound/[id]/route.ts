import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { updateLostfoundItemBodySchema } from "@/lib/modules/lostfound/lostfound.schemas";
import { deleteMyLostfoundItem, getMyLostfoundDetail, updateMyLostfoundItem } from "@/lib/modules/lostfound/lostfound.service";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const data = await getMyLostfoundDetail({ userId: user.id, itemId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await request.json();

    const parsed = updateLostfoundItemBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const res = await updateMyLostfoundItem({ userId: user.id, itemId: id, body: parsed.data });
    return NextResponse.json(res);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const res = await deleteMyLostfoundItem({ userId: user.id, itemId: id });
    return NextResponse.json(res);
  } catch (err) {
    return jsonError(err);
  }
}

