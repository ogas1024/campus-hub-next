import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { markNoticeRead } from "@/lib/modules/notices/notices.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const data = await markNoticeRead({ userId: user.id, noticeId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
