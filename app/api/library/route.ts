import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { parseIntParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { listPortalLibraryBooks } from "@/lib/modules/library/library.service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });
    const q = searchParams.get("q") ?? undefined;

    const formatParam = searchParams.get("format");
    const format =
      formatParam === "pdf" || formatParam === "epub" || formatParam === "mobi" || formatParam === "zip"
        ? formatParam
        : formatParam == null
          ? undefined
          : (() => {
              throw badRequest("format 必须为 pdf|epub|mobi|zip");
            })();

    const sortByParam = searchParams.get("sortBy");
    const sortBy = sortByParam === "downloadCount" ? "downloadCount" : ("publishedAt" as const);
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : ("desc" as const);

    const data = await listPortalLibraryBooks({ userId: user.id, page, pageSize, q: q?.trim() ? q.trim() : undefined, format, sortBy, sortOrder });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

