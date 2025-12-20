import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { requireUuid } from "@/lib/http/uuid";
import { uploadMyMaterialFile } from "@/lib/modules/materials/materials.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const ctx = getRequestContext(request);
    const { id } = await params;
    const materialId = requireUuid(id, "id");

    const formData = await request.formData();
    const itemIdRaw = formData.get("itemId");
    if (typeof itemIdRaw !== "string" || !itemIdRaw.trim()) throw badRequest("缺少 itemId");
    const itemId = requireUuid(itemIdRaw, "itemId");

    const file = formData.get("file");
    if (!(file instanceof File)) throw badRequest("缺少 file");

    const data = await uploadMyMaterialFile({
      userId: user.id,
      materialId,
      itemId,
      file,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

