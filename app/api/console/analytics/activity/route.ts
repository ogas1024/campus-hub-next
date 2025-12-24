import { NextResponse } from "next/server";

import { requireAnyPerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { getConsoleActivityHeatmap, parseAnalyticsDaysParam } from "@/lib/modules/analytics/analytics.service";
import { consoleEntryPermCodes } from "@/lib/navigation/modules";

export async function GET(request: Request) {
  try {
    await requireAnyPerm([...consoleEntryPermCodes]);
    const { searchParams } = new URL(request.url);
    const days = parseAnalyticsDaysParam(searchParams.get("days"), { defaultValue: 365 });
    const data = await getConsoleActivityHeatmap({ days });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
