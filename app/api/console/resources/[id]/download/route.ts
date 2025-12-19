import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { downloadConsoleResource } from "@/lib/modules/course-resources/courseResources.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:resource:read");
    const { id } = await params;
    const data = await downloadConsoleResource({ actorUserId: user.id, resourceId: id });
    return NextResponse.redirect(data.redirectUrl, { status: 302 });
  } catch (err) {
    return jsonError(err);
  }
}

