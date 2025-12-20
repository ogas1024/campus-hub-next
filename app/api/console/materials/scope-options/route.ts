import { NextResponse } from "next/server";

import { hasAnyPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { forbidden } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { getMaterialScopeOptions } from "@/lib/modules/materials/materials.service";

export async function GET() {
  try {
    const user = await requireUser();
    const ok = await hasAnyPerm(user.id, ["campus:material:create", "campus:material:update"]);
    if (!ok) throw forbidden();

    const data = await getMaterialScopeOptions();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
