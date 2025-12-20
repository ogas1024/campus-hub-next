import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { requireUuid } from "@/lib/http/uuid";
import { generateSurveyAiSummaryMarkdown } from "@/lib/modules/surveys/surveys.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:survey:ai_summary");
    const { id } = await params;
    const surveyId = requireUuid(id, "id");
    const data = await generateSurveyAiSummaryMarkdown({ actorUserId: user.id, surveyId });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
