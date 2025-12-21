import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { parseBooleanParam, parseIntParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { listPortalLostfound } from "@/lib/modules/lostfound/lostfound.service";
import { parseIsoDateTimeOrNull } from "@/lib/modules/lostfound/lostfound.utils";

export async function GET(request: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });

    const typeParam = searchParams.get("type");
    const type = typeParam === "lost" || typeParam === "found" ? typeParam : undefined;
    if (typeParam && !type) throw badRequest("type 仅支持 lost / found");

    const q = searchParams.get("q")?.trim() || undefined;
    const includeSolved = parseBooleanParam(searchParams.get("solved"), { defaultValue: false });
    const from = parseIsoDateTimeOrNull(searchParams.get("from"), "from") ?? undefined;
    const to = parseIsoDateTimeOrNull(searchParams.get("to"), "to") ?? undefined;

    const data = await listPortalLostfound({ page, pageSize, type, q, includeSolved, from, to });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

