import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { deleteConsoleLostfound, getConsoleLostfoundDetail } from "@/lib/modules/lostfound/lostfound.service";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePerm("campus:lostfound:list");
    const { id } = await ctx.params;
    const data = await getConsoleLostfoundDetail({ itemId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:lostfound:delete");
    const { id } = await ctx.params;
    const ctxMeta = getRequestContext(request);

    const res = await deleteConsoleLostfound({
      itemId: id,
      actor: { userId: user.id, email: user.email },
      request: ctxMeta,
    });
    return NextResponse.json(res);
  } catch (err) {
    return jsonError(err);
  }
}

