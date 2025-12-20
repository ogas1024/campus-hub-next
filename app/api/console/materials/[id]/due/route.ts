import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { requireUuid } from "@/lib/http/uuid";
import { updateMaterialDueAtBodySchema } from "@/lib/modules/materials/materials.schemas";
import { updateMaterialDueAt } from "@/lib/modules/materials/materials.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:material:update");
    const ctx = getRequestContext(request);
    const { id } = await params;
    const materialId = requireUuid(id, "id");

    const body = await request.json();
    const parsed = updateMaterialDueAtBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await updateMaterialDueAt({
      actorUserId: user.id,
      materialId,
      dueAt: parsed.data.dueAt,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

