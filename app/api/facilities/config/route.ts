import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { getPortalFacilityConfig } from "@/lib/modules/facilities/facilities.service";

export async function GET() {
  try {
    await requireUser();
    const data = await getPortalFacilityConfig();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

