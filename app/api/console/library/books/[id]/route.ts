import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { getConsoleLibraryBookDetail, hardDeleteConsoleLibraryBook } from "@/lib/modules/library/library.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePerm("campus:library:read");
    const { id } = await params;
    const data = await getConsoleLibraryBookDetail({ bookId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:library:delete");
    const ctx = getRequestContext(request);
    const { id } = await params;
    const reason = new URL(request.url).searchParams.get("reason") ?? undefined;
    const data = await hardDeleteConsoleLibraryBook({
      bookId: id,
      actor: { userId: user.id, email: user.email },
      request: ctx,
      reason: reason?.trim() ? reason.trim() : undefined,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

