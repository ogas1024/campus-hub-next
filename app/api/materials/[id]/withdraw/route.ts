import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { requireUuid } from "@/lib/http/uuid";
import { withdrawMyMaterial } from "@/lib/modules/materials/materials.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const ctx = getRequestContext(request);
    const { id } = await params;
    const materialId = requireUuid(id, "id");

    const data = await withdrawMyMaterial({ userId: user.id, materialId, actor: { userId: user.id, email: user.email }, request: ctx });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

