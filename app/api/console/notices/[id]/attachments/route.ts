import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { uploadNoticeAttachment } from "@/lib/modules/notices/notices.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:notice:update");
    const ctx = getRequestContext(request);
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw badRequest("缺少 file");

    const data = await uploadNoticeAttachment({ noticeId: id, file, actor: { userId: user.id, email: user.email }, request: ctx });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
