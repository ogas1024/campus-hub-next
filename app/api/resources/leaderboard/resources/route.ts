import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { parseIntParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { getPortalResourceDownloadLeaderboard } from "@/lib/modules/course-resources/courseResources.service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const scopeParam = searchParams.get("scope") ?? "global";
    if (scopeParam !== "global" && scopeParam !== "major" && scopeParam !== "course") {
      throw badRequest("scope 必须为 global|major|course");
    }

    const days = parseIntParam(searchParams.get("days"), { defaultValue: 30, min: 1, max: 365 });
    const majorId = searchParams.get("majorId") ?? undefined;
    const courseId = searchParams.get("courseId") ?? undefined;

    const data = await getPortalResourceDownloadLeaderboard({ userId: user.id, scope: scopeParam, days, majorId, courseId });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

