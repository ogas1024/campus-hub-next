import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { removeMyAvatar, uploadMyAvatar } from "@/lib/modules/profile/avatar.service";
import { getMyProfile } from "@/lib/modules/profile/profile.service";

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

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw badRequest("请上传头像文件（字段名：file）");
    }

    const updated = await uploadMyAvatar({ userId: user.id, file });
    return NextResponse.json(toResponse(updated));
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    const updated = await removeMyAvatar({ userId: user.id });
    return NextResponse.json(toResponse(updated));
  } catch (err) {
    return jsonError(err);
  }
}

