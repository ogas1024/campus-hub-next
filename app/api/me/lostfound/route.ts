import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { parseIntParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { createLostfoundItemBodySchema } from "@/lib/modules/lostfound/lostfound.schemas";
import { createMyLostfoundItem, listMyLostfoundItems } from "@/lib/modules/lostfound/lostfound.service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });
    const q = searchParams.get("q")?.trim() || undefined;

    const statusParam = searchParams.get("status");
    const status =
      statusParam === "pending" || statusParam === "published" || statusParam === "rejected" || statusParam === "offline"
        ? statusParam
        : undefined;

    const data = await listMyLostfoundItems({ userId: user.id, page, pageSize, status, q });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const parsed = createLostfoundItemBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const created = await createMyLostfoundItem({
      userId: user.id,
      body: {
        type: parsed.data.type,
        title: parsed.data.title,
        content: parsed.data.content,
        location: parsed.data.location ?? null,
        occurredAt: parsed.data.occurredAt ?? null,
        contactInfo: parsed.data.contactInfo ?? null,
        imageKeys: parsed.data.imageKeys,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

