import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { parseIntParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { listMyFavoriteLibraryBooks } from "@/lib/modules/library/library.service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });

    const data = await listMyFavoriteLibraryBooks({ userId: user.id, page, pageSize });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

