import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { createRoleBodySchema } from "@/lib/modules/rbac/rbac.schemas";
import { createRole, listRoles } from "@/lib/modules/rbac/rbac.service";

export async function GET() {
  try {
    await requirePerm("campus:role:*");
    const data = await listRoles();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePerm("campus:role:*");
    const ctx = getRequestContext(request);

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = createRoleBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const id = await createRole({
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description,
      reason: parsed.data.reason,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

