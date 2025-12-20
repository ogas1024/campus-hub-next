import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { requireUuid } from "@/lib/http/uuid";
import { uploadMaterialItemTemplate } from "@/lib/modules/materials/materials.service";

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:material:update");
    const ctx = getRequestContext(request);
    const { id, itemId } = await params;
    const materialId = requireUuid(id, "id");
    const iid = requireUuid(itemId, "itemId");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw badRequest("缺少 file");

    const data = await uploadMaterialItemTemplate({
      actorUserId: user.id,
      materialId,
      itemId: iid,
      file,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

