import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { getNoticeScopeOptions } from "@/lib/modules/notices/notices.service";

export async function GET() {
  try {
    await requirePerm("campus:notice:create");
    const data = await getNoticeScopeOptions();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
