import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { listPortalFloors } from "@/lib/modules/facilities/facilities.service";

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);

    const buildingId = searchParams.get("buildingId");
    if (!buildingId) throw badRequest("buildingId 必填");

    const data = await listPortalFloors(buildingId);
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

