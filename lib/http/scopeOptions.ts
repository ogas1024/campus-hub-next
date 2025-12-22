import { NextResponse } from "next/server";

import { hasAnyPerm } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { forbidden } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { getVisibilityScopeOptions } from "@/lib/modules/content-visibility/scopeOptions";

export async function handleConsoleScopeOptionsRequest(requiredAnyPerms: string[]) {
  try {
    const user = await requireUser();
    const ok = await hasAnyPerm(user.id, requiredAnyPerms);
    if (!ok) throw forbidden();

    const data = await getVisibilityScopeOptions();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

