import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { findPortalMaterialByNoticeId } from "@/lib/modules/materials/materials.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const data = await findPortalMaterialByNoticeId({ userId: user.id, noticeId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

