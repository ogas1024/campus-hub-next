import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { listPortalBuildings } from "@/lib/modules/facilities/facilities.service";

export async function GET() {
  try {
    await requireUser();
    const data = await listPortalBuildings();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

