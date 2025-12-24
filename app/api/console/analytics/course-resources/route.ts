import { NextResponse } from "next/server";

import { requireAnyPerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { getConsoleCourseResourcesAnalytics, parseAnalyticsDaysParam } from "@/lib/modules/analytics/analytics.service";
import { courseResourcesConsoleEntryPermCodes } from "@/lib/navigation/modules";

export async function GET(request: Request) {
  try {
    await requireAnyPerm([...courseResourcesConsoleEntryPermCodes]);
    const { searchParams } = new URL(request.url);
    const days = parseAnalyticsDaysParam(searchParams.get("days"), { defaultValue: 30 });
    const data = await getConsoleCourseResourcesAnalytics({ days });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
