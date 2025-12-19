import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { getPortalSurveyDetail } from "@/lib/modules/surveys/surveys.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const data = await getPortalSurveyDetail({ userId: user.id, surveyId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

