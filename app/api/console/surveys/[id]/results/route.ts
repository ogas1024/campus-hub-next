import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { getSurveyResults } from "@/lib/modules/surveys/surveys.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:survey:read");
    const { id } = await params;
    const data = await getSurveyResults({ actorUserId: user.id, surveyId: id });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

