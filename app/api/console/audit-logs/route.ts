import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { parseIntParam, parseTriStateBooleanParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { listAuditLogs } from "@/lib/modules/audit/audit.service";

function parseDateParam(value: string | null) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest("时间参数必须为 ISO 格式");
  return d;
}

export async function GET(request: Request) {
  try {
    await requirePerm("campus:audit:list");

    const { searchParams } = new URL(request.url);
    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });
    const q = searchParams.get("q") ?? undefined;
    const action = searchParams.get("action") ?? undefined;
    const targetType = searchParams.get("targetType") ?? undefined;
    const targetId = searchParams.get("targetId") ?? undefined;
    const actorUserId = searchParams.get("actorUserId") ?? undefined;
    const success = parseTriStateBooleanParam(searchParams.get("success"));
    const from = parseDateParam(searchParams.get("from"));
    const to = parseDateParam(searchParams.get("to"));

    const data = await listAuditLogs({
      page,
      pageSize,
      q,
      action,
      targetType,
      targetId,
      actorUserId,
      success,
      from,
      to,
    });

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
