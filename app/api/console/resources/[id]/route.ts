import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { getConsoleResourceDetail, hardDeleteConsoleResource } from "@/lib/modules/course-resources/courseResources.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:resource:read");
    const { id } = await params;
    const data = await getConsoleResourceDetail({ actorUserId: user.id, resourceId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:resource:delete");
    const ctx = getRequestContext(request);
    const { id } = await params;
    const reason = new URL(request.url).searchParams.get("reason") ?? undefined;
    const data = await hardDeleteConsoleResource({
      resourceId: id,
      actor: { userId: user.id, email: user.email },
      request: ctx,
      reason: reason?.trim() ? reason.trim() : undefined,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
