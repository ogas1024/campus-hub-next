import { NextResponse } from "next/server";

import { hasPerm, requirePerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { findConsoleMaterialByNoticeId } from "@/lib/modules/materials/materials.service";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePerm("campus:notice:list");
    const { id } = await ctx.params;

    const [canCreate, canRead, canProcess] = await Promise.all([
      hasPerm(user.id, "campus:material:create"),
      hasPerm(user.id, "campus:material:read"),
      hasPerm(user.id, "campus:material:process"),
    ]);

    const linked = canRead ? await findConsoleMaterialByNoticeId({ actorUserId: user.id, noticeId: id }).catch(() => null) : null;

    return NextResponse.json({
      perms: { canCreate, canRead, canProcess },
      linked: linked
        ? {
            id: linked.id,
            title: linked.title,
            status: linked.status,
            dueAt: linked.dueAt,
            archivedAt: linked.archivedAt,
          }
        : null,
    });
  } catch (err) {
    return jsonError(err);
  }
}

