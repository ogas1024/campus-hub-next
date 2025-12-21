import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { downloadConsoleLibraryBook } from "@/lib/modules/library/library.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    await requirePerm("campus:library:read");
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const assetIdFromQuery = searchParams.get("assetId") ?? undefined;
    const body = await request.json().catch(() => null);
    const assetIdFromJson = (body as { assetId?: string } | null)?.assetId ?? undefined;
    const assetId = assetIdFromQuery ?? assetIdFromJson;

    const data = await downloadConsoleLibraryBook({ bookId: id, assetId });
    return NextResponse.redirect(data.redirectUrl, { status: 302 });
  } catch (err) {
    return jsonError(err);
  }
}
