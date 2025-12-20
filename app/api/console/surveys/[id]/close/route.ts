import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { requireUuid } from "@/lib/http/uuid";
import { closeSurvey } from "@/lib/modules/surveys/surveys.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:survey:close");
    const ctx = getRequestContext(request);
    const { id } = await params;
    const surveyId = requireUuid(id, "id");

    const data = await closeSurvey({ actorUserId: user.id, surveyId, actor: { userId: user.id, email: user.email }, request: ctx });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
