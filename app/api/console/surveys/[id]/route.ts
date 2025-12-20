import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { requireUuid } from "@/lib/http/uuid";
import { updateSurveyDraftBodySchema } from "@/lib/modules/surveys/surveys.schemas";
import { deleteSurvey, getConsoleSurveyDetail, updateSurveyDraft } from "@/lib/modules/surveys/surveys.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:survey:read");
    const { id } = await params;
    const surveyId = requireUuid(id, "id");
    const data = await getConsoleSurveyDetail({ actorUserId: user.id, surveyId });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:survey:update");
    const ctx = getRequestContext(request);
    const { id } = await params;
    const surveyId = requireUuid(id, "id");

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = updateSurveyDraftBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await updateSurveyDraft({
      actorUserId: user.id,
      surveyId,
      body: parsed.data,
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
    const user = await requirePerm("campus:survey:delete");
    const ctx = getRequestContext(request);
    const { id } = await params;
    const surveyId = requireUuid(id, "id");
    const data = await deleteSurvey({ actorUserId: user.id, surveyId, actor: { userId: user.id, email: user.email }, request: ctx });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
