import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { restoreConsoleLostfound } from "@/lib/modules/lostfound/lostfound.service";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:lostfound:restore");
    const { id } = await ctx.params;
    const ctxMeta = getRequestContext(request);

    const res = await restoreConsoleLostfound({ itemId: id, actor: { userId: user.id, email: user.email }, request: ctxMeta });
    return NextResponse.json(res);
  } catch (err) {
    return jsonError(err);
  }
}

