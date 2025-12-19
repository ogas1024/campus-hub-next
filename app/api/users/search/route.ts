import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { parseIntParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { searchActiveUsers } from "@/lib/modules/facilities/facilities.service";

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q");
    if (!q || !q.trim()) throw badRequest("q 必填");
    const limit = parseIntParam(searchParams.get("limit"), { defaultValue: 10, min: 1, max: 20 });

    const data = await searchActiveUsers({ q, limit });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

