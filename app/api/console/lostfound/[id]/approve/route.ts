import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { approveConsoleLostfound } from "@/lib/modules/lostfound/lostfound.service";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:lostfound:review");
    const { id } = await ctx.params;
    const ctxMeta = getRequestContext(request);

    const res = await approveConsoleLostfound({ itemId: id, actor: { userId: user.id, email: user.email }, request: ctxMeta });
    return NextResponse.json(res);
  } catch (err) {
    return jsonError(err);
  }
}

