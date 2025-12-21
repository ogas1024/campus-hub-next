import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { deleteMyLibraryBookAsset } from "@/lib/modules/library/library.service";

type Params = { params: Promise<{ id: string; assetId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id, assetId } = await params;

    const data = await deleteMyLibraryBookAsset({ userId: user.id, bookId: id, assetId });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

