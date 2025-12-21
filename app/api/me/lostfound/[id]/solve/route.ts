import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { solveMyLostfoundItem } from "@/lib/modules/lostfound/lostfound.service";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const res = await solveMyLostfoundItem({ userId: user.id, itemId: id });
    return NextResponse.json(res);
  } catch (err) {
    return jsonError(err);
  }
}

