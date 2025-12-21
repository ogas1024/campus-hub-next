import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { reviewRejectBodySchema } from "@/lib/modules/library/library.schemas";
import { rejectConsoleLibraryBook } from "@/lib/modules/library/library.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:library:review");
    const ctx = getRequestContext(request);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = reviewRejectBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await rejectConsoleLibraryBook({
      bookId: id,
      comment: parsed.data.comment,
      actor: { userId: user.id, email: user.email },
      request: ctx,
      reason: parsed.data.reason,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

