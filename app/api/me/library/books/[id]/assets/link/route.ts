import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { createMyLibraryBookLinkAssetBodySchema } from "@/lib/modules/library/library.schemas";
import { createMyLibraryBookLinkAsset } from "@/lib/modules/library/library.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = createMyLibraryBookLinkAssetBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await createMyLibraryBookLinkAsset({ userId: user.id, bookId: id, url: parsed.data.url });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

