import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { downloadPortalLibraryBook } from "@/lib/modules/library/library.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const ctx = getRequestContext(request);
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const assetIdFromQuery = searchParams.get("assetId") ?? undefined;
    const body = await request.json().catch(() => null);
    const assetIdFromJson = (body as { assetId?: string } | null)?.assetId ?? undefined;
    const assetId = assetIdFromQuery ?? assetIdFromJson;

    const data = await downloadPortalLibraryBook({ userId: user.id, bookId: id, assetId, request: ctx });
    return NextResponse.redirect(data.redirectUrl, { status: 302 });
  } catch (err) {
    return jsonError(err);
  }
}
