import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { createDepartmentBodySchema } from "@/lib/modules/organization/organization.schemas";
import { createDepartment, listDepartments } from "@/lib/modules/organization/organization.service";

export async function GET() {
  try {
    await requirePerm("campus:department:*");
    const data = await listDepartments();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePerm("campus:department:*");
    const ctx = getRequestContext(request);

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = createDepartmentBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const id = await createDepartment({
      name: parsed.data.name,
      parentId: parsed.data.parentId ?? null,
      sort: parsed.data.sort,
      reason: parsed.data.reason,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

