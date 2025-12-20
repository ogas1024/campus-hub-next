import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { parseBooleanParam, parseIntParam } from "@/lib/http/query";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { createMaterialBodySchema } from "@/lib/modules/materials/materials.schemas";
import { createMaterialDraft, listConsoleMaterials } from "@/lib/modules/materials/materials.service";

export async function GET(request: Request) {
  try {
    const user = await requirePerm("campus:material:list");
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });
    const q = searchParams.get("q")?.trim() || undefined;
    const mine = parseBooleanParam(searchParams.get("mine"), { defaultValue: false });
    const archived = parseBooleanParam(searchParams.get("archived"), { defaultValue: false });

    const statusParam = searchParams.get("status");
    const status = statusParam === "draft" || statusParam === "published" || statusParam === "closed" ? statusParam : undefined;

    const data = await listConsoleMaterials({ actorUserId: user.id, page, pageSize, q, status, mine, archived });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePerm("campus:material:create");
    const ctx = getRequestContext(request);
    const body = await request.json();

    const parsed = createMaterialBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const created = await createMaterialDraft({
      actorUserId: user.id,
      body: {
        title: parsed.data.title,
        descriptionMd: parsed.data.descriptionMd,
        noticeId: parsed.data.noticeId ?? null,
        visibleAll: parsed.data.visibleAll,
        scopes: parsed.data.scopes,
        maxFilesPerSubmission: parsed.data.maxFilesPerSubmission,
        dueAt: parsed.data.dueAt ?? null,
        items: parsed.data.items.map((i) => ({ ...i, description: i.description ?? null })),
      },
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
