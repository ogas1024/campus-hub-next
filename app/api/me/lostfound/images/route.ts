import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { uploadMyLostfoundImage } from "@/lib/modules/lostfound/lostfound.service";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw badRequest("请上传图片文件（字段名：file）");
    }

    const res = await uploadMyLostfoundImage({ userId: user.id, file });
    return NextResponse.json(res, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

