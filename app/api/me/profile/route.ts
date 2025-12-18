import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { updateMyProfileBodySchema } from "@/lib/modules/profile/profile.schemas";
import { getMyProfile, updateMyProfileBasics } from "@/lib/modules/profile/profile.service";

function toResponse(data: Awaited<ReturnType<typeof getMyProfile>>) {
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    username: data.username,
    studentId: data.studentId,
    avatarUrl: data.avatarUrl,
    status: data.status,
    createdAt: data.createdAt.toISOString(),
    updatedAt: data.updatedAt.toISOString(),
    lastLoginAt: data.lastLoginAt ? data.lastLoginAt.toISOString() : null,
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await getMyProfile(user.id);
    return NextResponse.json(toResponse(profile), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = updateMyProfileBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const { name, username } = parsed.data;
    if (typeof name === "undefined" && typeof username === "undefined") {
      throw badRequest("至少提供一个可修改字段");
    }

    const updated = await updateMyProfileBasics({ userId: user.id, patch: { name, username } });

    return NextResponse.json(toResponse(updated));
  } catch (err) {
    return jsonError(err);
  }
}
