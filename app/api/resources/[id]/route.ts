import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { getPortalResourceDetail } from "@/lib/modules/course-resources/courseResources.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const data = await getPortalResourceDetail({ userId: user.id, resourceId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

