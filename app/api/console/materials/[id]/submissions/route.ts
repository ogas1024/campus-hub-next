import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { parseIntParam, parseTriStateBooleanParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { requireUuid } from "@/lib/http/uuid";
import { listConsoleMaterialSubmissions } from "@/lib/modules/materials/materials.service";

type Params = { params: Promise<{ id: string }> };

function parseIsoDate(value: string | null) {
  if (!value) return undefined;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:material:process");
    const { id } = await params;
    const materialId = requireUuid(id, "id");

    const { searchParams } = new URL(request.url);
    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });

    const q = searchParams.get("q")?.trim() || undefined;
    const statusParam = searchParams.get("status");
    const status =
      statusParam === "pending" || statusParam === "complete" || statusParam === "need_more" || statusParam === "approved" || statusParam === "rejected"
        ? statusParam
        : undefined;

    const missingRequired = parseTriStateBooleanParam(searchParams.get("missingRequired"));
    const from = parseIsoDate(searchParams.get("from"));
    const to = parseIsoDate(searchParams.get("to"));
    const departmentId = searchParams.get("departmentId")?.trim() || undefined;

    const data = await listConsoleMaterialSubmissions({
      actorUserId: user.id,
      materialId,
      page,
      pageSize,
      q,
      status,
      missingRequired,
      from,
      to,
      departmentId,
    });

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

