import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { setRoleDataScopesBodySchema } from "@/lib/modules/data-permission/dataPermission.schemas";
import { getRoleDataScopes, setRoleDataScopes } from "@/lib/modules/data-permission/dataPermission.service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePerm("campus:role:*");
    const { id } = await params;
    const data = await getRoleDataScopes(id);
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:role:*");
    const ctx = getRequestContext(request);
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = setRoleDataScopesBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await setRoleDataScopes({
      roleId: id,
      items: parsed.data.items,
      reason: parsed.data.reason,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

