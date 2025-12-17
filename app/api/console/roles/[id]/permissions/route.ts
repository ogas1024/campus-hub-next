import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { setRolePermissionsBodySchema } from "@/lib/modules/rbac/rbac.schemas";
import { getRolePermissionCodes, setRolePermissions } from "@/lib/modules/rbac/rbac.service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePerm("campus:role:*");
    const { id } = await params;
    const data = await getRolePermissionCodes(id);
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
    const parsed = setRolePermissionsBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await setRolePermissions({
      roleId: id,
      permissionCodes: parsed.data.permissionCodes,
      reason: parsed.data.reason,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
