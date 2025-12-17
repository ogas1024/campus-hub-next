import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { getRegistrationConfig, setRegistrationConfig } from "@/lib/modules/config/config.service";

const updateSchema = z
  .object({
    requiresApproval: z.boolean(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export async function GET() {
  try {
    await requirePerm("campus:config:update");
    const data = await getRegistrationConfig();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requirePerm("campus:config:update");
    const ctx = getRequestContext(request);

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await setRegistrationConfig({
      requiresApproval: parsed.data.requiresApproval,
      reason: parsed.data.reason,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

