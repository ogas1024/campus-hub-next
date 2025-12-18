import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { parseBooleanParam } from "@/lib/http/query";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { deleteUser, getConsoleUserDetail } from "@/lib/modules/iam/users.service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:user:read");
    const { id } = await params;
    const data = await getConsoleUserDetail({ actorUserId: user.id, userId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:user:delete");
    const { id } = await params;
    const ctx = getRequestContext(request);

    const { searchParams } = new URL(request.url);
    const soft = parseBooleanParam(searchParams.get("soft"), { defaultValue: true });
    const reason = searchParams.get("reason") ?? undefined;
    if (!soft) throw badRequest("MVP 仅允许 soft delete");

    const data = await deleteUser({ userId: id, reason, actor: { userId: user.id, email: user.email }, request: ctx });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

