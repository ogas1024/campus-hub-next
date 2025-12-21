import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { parseIntParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { createMyLibraryBookDraftBodySchema } from "@/lib/modules/library/library.schemas";
import { createMyLibraryBookDraft, listMyLibraryBooks } from "@/lib/modules/library/library.service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });
    const q = searchParams.get("q") ?? undefined;

    const statusParam = searchParams.get("status") ?? undefined;
    const status =
      statusParam === "draft" ||
      statusParam === "pending" ||
      statusParam === "published" ||
      statusParam === "rejected" ||
      statusParam === "unpublished"
        ? statusParam
        : undefined;

    const data = await listMyLibraryBooks({ userId: user.id, page, pageSize, status, q: q?.trim() ? q.trim() : undefined });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = createMyLibraryBookDraftBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await createMyLibraryBookDraft({ userId: user.id, ...parsed.data });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

