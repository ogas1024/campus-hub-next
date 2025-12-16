import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { publishNotice } from "@/lib/modules/notices/notices.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:notice:publish");
    const { id } = await params;

    const data = await publishNotice({ userId: user.id, noticeId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
