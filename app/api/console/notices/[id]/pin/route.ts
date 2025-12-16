import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { pinNoticeBodySchema } from "@/lib/modules/notices/notices.schemas";
import { setNoticePinned } from "@/lib/modules/notices/notices.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:notice:pin");
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = pinNoticeBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await setNoticePinned({ userId: user.id, noticeId: id, pinned: parsed.data.pinned });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
