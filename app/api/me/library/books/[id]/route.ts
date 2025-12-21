import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { updateMyLibraryBookBodySchema } from "@/lib/modules/library/library.schemas";
import { deleteMyLibraryBook, getMyLibraryBookDetail, updateMyLibraryBook } from "@/lib/modules/library/library.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const data = await getMyLibraryBookDetail({ userId: user.id, bookId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = updateMyLibraryBookBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await updateMyLibraryBook({ userId: user.id, bookId: id, patch: parsed.data });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const data = await deleteMyLibraryBook({ userId: user.id, bookId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

