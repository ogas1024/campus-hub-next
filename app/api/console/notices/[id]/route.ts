import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { updateNoticeBodySchema } from "@/lib/modules/notices/notices.schemas";
import { deleteNotice, getConsoleNoticeDetail, updateNotice } from "@/lib/modules/notices/notices.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:notice:list");
    const { id } = await params;

    const data = await getConsoleNoticeDetail({ userId: user.id, noticeId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:notice:update");
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = updateNoticeBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await updateNotice({ userId: user.id, noticeId: id, ...parsed.data });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:notice:delete");
    const { id } = await params;

    const data = await deleteNotice({ userId: user.id, noticeId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
