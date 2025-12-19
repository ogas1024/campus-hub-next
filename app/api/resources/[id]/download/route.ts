import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { downloadPortalResource } from "@/lib/modules/course-resources/courseResources.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const ctx = getRequestContext(request);
    const { id } = await params;

    const data = await downloadPortalResource({ userId: user.id, resourceId: id, request: ctx });
    return NextResponse.redirect(data.redirectUrl, { status: 302 });
  } catch (err) {
    return jsonError(err);
  }
}

