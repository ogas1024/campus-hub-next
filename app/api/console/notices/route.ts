import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { parseBooleanParam, parseIntParam } from "@/lib/http/query";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { createNoticeBodySchema } from "@/lib/modules/notices/notices.schemas";
import { createNotice, listConsoleNotices } from "@/lib/modules/notices/notices.service";

export async function GET(request: Request) {
  try {
    const user = await requirePerm("campus:notice:list");
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });
    const q = searchParams.get("q") ?? undefined;
    const includeExpired = parseBooleanParam(searchParams.get("includeExpired"), { defaultValue: true });

    const status = searchParams.get("status") ?? undefined;
    const statusValue =
      status === "draft" || status === "published" || status === "retracted" ? status : undefined;

    const mine = parseBooleanParam(searchParams.get("mine"), { defaultValue: false });

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
    const ctx = getRequestContext(request);
    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = createNoticeBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await createNotice({ ...parsed.data, actor: { userId: user.id, email: user.email }, request: ctx });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
