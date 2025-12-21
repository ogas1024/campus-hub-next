import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { parseIntParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { listConsoleLostfound } from "@/lib/modules/lostfound/lostfound.service";
import { parseIsoDateTimeOrNull } from "@/lib/modules/lostfound/lostfound.utils";

export async function GET(request: Request) {
  try {
    await requirePerm("campus:lostfound:list");
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });

    const statusParam = searchParams.get("status");
    const status =
      statusParam === "pending" || statusParam === "published" || statusParam === "rejected" || statusParam === "offline"
        ? statusParam
        : undefined;
    if (statusParam && !status) throw badRequest("status 仅支持 pending / published / rejected / offline");

    const typeParam = searchParams.get("type");
    const type = typeParam === "lost" || typeParam === "found" ? typeParam : undefined;
    if (typeParam && !type) throw badRequest("type 仅支持 lost / found");

    const q = searchParams.get("q")?.trim() || undefined;
    const from = parseIsoDateTimeOrNull(searchParams.get("from"), "from") ?? undefined;
    const to = parseIsoDateTimeOrNull(searchParams.get("to"), "to") ?? undefined;

    const data = await listConsoleLostfound({ page, pageSize, status, type, q, from, to });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

