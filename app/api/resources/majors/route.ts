import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http/route";
import { listPortalMajors } from "@/lib/modules/course-resources/courseResources.service";

export async function GET() {
  try {
    await requireUser();
    const data = await listPortalMajors();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
