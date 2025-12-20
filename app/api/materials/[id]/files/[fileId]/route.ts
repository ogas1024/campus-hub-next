import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { requireUuid } from "@/lib/http/uuid";
import { deleteMyMaterialFile } from "@/lib/modules/materials/materials.service";

type Params = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const ctx = getRequestContext(request);
    const { id, fileId } = await params;
    const materialId = requireUuid(id, "id");
    const fid = requireUuid(fileId, "fileId");

    const data = await deleteMyMaterialFile({
      userId: user.id,
      materialId,
      fileId: fid,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

