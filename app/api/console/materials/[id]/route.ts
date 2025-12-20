import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { requireUuid } from "@/lib/http/uuid";
import { updateMaterialDraftBodySchema } from "@/lib/modules/materials/materials.schemas";
import { deleteMaterial, getConsoleMaterialDetail, updateMaterialDraft } from "@/lib/modules/materials/materials.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:material:read");
    const { id } = await params;
    const materialId = requireUuid(id, "id");

    const data = await getConsoleMaterialDetail({ actorUserId: user.id, materialId });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:material:update");
    const ctx = getRequestContext(request);
    const { id } = await params;
    const materialId = requireUuid(id, "id");

    const body = await request.json();
    const parsed = updateMaterialDraftBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await updateMaterialDraft({
      actorUserId: user.id,
      materialId,
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

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:material:delete");
    const ctx = getRequestContext(request);
    const { id } = await params;
    const materialId = requireUuid(id, "id");

    const { searchParams } = new URL(request.url);
    const reason = searchParams.get("reason")?.trim() || undefined;

    const data = await deleteMaterial({
      actorUserId: user.id,
      materialId,
      actor: { userId: user.id, email: user.email },
      request: ctx,
      reason,
    });

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
