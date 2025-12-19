import { NextResponse } from "next/server";

import { hasAnyPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { forbidden } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { getSurveyScopeOptions } from "@/lib/modules/surveys/surveys.service";

export async function GET() {
  try {
    const user = await requireUser();
    const ok = await hasAnyPerm(user.id, ["campus:survey:create", "campus:survey:update"]);
    if (!ok) throw forbidden();
    const data = await getSurveyScopeOptions();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

