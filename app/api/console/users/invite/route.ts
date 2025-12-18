import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { inviteConsoleUserBodySchema } from "@/lib/modules/iam/users.schemas";
import { inviteConsoleUser } from "@/lib/modules/iam/users.service";

export async function POST(request: Request) {
  try {
    const user = await requirePerm("campus:user:invite");
    const ctx = getRequestContext(request);

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = inviteConsoleUserBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await inviteConsoleUser({
      ...parsed.data,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

