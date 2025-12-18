import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { listPermissions } from "@/lib/modules/rbac/rbac.service";

export async function GET() {
  try {
    await requirePerm("campus:permission:*");
    const data = await listPermissions();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

