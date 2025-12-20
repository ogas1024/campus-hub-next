import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { requireUuid } from "@/lib/http/uuid";
import { publishMaterial } from "@/lib/modules/materials/materials.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:material:publish");
    const ctx = getRequestContext(request);
    const { id } = await params;
    const materialId = requireUuid(id, "id");

    const data = await publishMaterial({ actorUserId: user.id, materialId, actor: { userId: user.id, email: user.email }, request: ctx });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

