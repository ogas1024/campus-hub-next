import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { parseIntParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { listConsoleReservations } from "@/lib/modules/facilities/facilities.service";

function parseIsoParam(value: string | null, name: string) {
  if (!value) return undefined;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) throw badRequest(`${name} 必须为 ISO 时间字符串`);
  return d;
}

export async function GET(request: Request) {
  try {
    const user = await requirePerm("campus:facility:review");
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });

    const status = (searchParams.get("status") ?? undefined) as "pending" | "approved" | "rejected" | "cancelled" | undefined;
    if (status && !["pending", "approved", "rejected", "cancelled"].includes(status)) throw badRequest("status 无效");

    const buildingId = searchParams.get("buildingId") ?? undefined;
    const roomId = searchParams.get("roomId") ?? undefined;
    const q = searchParams.get("q") ?? undefined;
    const floorNoRaw = searchParams.get("floorNo");
    let floorNo: number | undefined;
    if (floorNoRaw != null) {
      const parsed = Number(floorNoRaw);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) throw badRequest("floorNo 必须为整数");
      floorNo = parsed;
    }

    const from = parseIsoParam(searchParams.get("from"), "from");
    const to = parseIsoParam(searchParams.get("to"), "to");

    const data = await listConsoleReservations({ actorUserId: user.id, page, pageSize, status, buildingId, floorNo, roomId, q, from, to });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
