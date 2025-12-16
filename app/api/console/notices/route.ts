import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { createNoticeBodySchema } from "@/lib/modules/notices/notices.schemas";
import { createNotice, listConsoleNotices } from "@/lib/modules/notices/notices.service";

export async function GET(request: Request) {
  try {
    const user = await requirePerm("campus:notice:list");
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
    const q = searchParams.get("q") ?? undefined;
    const includeExpired = searchParams.get("includeExpired") !== "false";

    const status = searchParams.get("status") ?? undefined;
    const statusValue =
      status === "draft" || status === "published" || status === "retracted" ? status : undefined;

    const mine = searchParams.get("mine") === "true";

    const data = await listConsoleNotices({
      userId: user.id,
      page,
      pageSize,
      q,
      includeExpired,
      status: statusValue,
      mine,
    });

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePerm("campus:notice:create");
    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = createNoticeBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await createNotice({ userId: user.id, ...parsed.data });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
