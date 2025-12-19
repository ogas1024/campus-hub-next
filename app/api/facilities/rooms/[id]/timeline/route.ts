import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { parseIntParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { getPortalRoomTimeline } from "@/lib/modules/facilities/facilities.service";

function parseIsoParam(value: string | null, name: string) {
  if (!value) throw badRequest(`${name} 必填`);
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) throw badRequest(`${name} 必须为 ISO 时间字符串`);
  return d;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const days = parseIntParam(searchParams.get("days"), { defaultValue: 30, min: 1, max: 30 });
    if (![7, 30].includes(days)) throw badRequest("days 仅支持 7 或 30");

    const from = parseIsoParam(searchParams.get("from"), "from");

    const data = await getPortalRoomTimeline({ roomId: id, from, days });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

