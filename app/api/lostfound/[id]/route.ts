import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { getPortalLostfoundDetail } from "@/lib/modules/lostfound/lostfound.service";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const data = await getPortalLostfoundDetail({ itemId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

