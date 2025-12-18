import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { getAuditLogDetail } from "@/lib/modules/audit/audit.service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePerm("campus:audit:list");
    const { id } = await params;
    const data = await getAuditLogDetail(id);
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

