import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { consoleRejectBodySchema } from "@/lib/modules/lostfound/lostfound.schemas";
import { rejectConsoleLostfound } from "@/lib/modules/lostfound/lostfound.service";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:lostfound:review");
    const { id } = await ctx.params;
    const ctxMeta = getRequestContext(request);
    const body = await request.json();

    const parsed = consoleRejectBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const res = await rejectConsoleLostfound({
      itemId: id,
      reason: parsed.data.reason,
      actor: { userId: user.id, email: user.email },
      request: ctxMeta,
    });
    return NextResponse.json(res);
  } catch (err) {
    return jsonError(err);
  }
}

