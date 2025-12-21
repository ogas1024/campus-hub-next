import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { parseIntParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { listConsoleLibraryBooks } from "@/lib/modules/library/library.service";

export async function GET(request: Request) {
  try {
    await requirePerm("campus:library:list");
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });
    const q = searchParams.get("q") ?? undefined;

    const statusParam = searchParams.get("status") ?? undefined;
    const status =
      statusParam === "draft" ||
      statusParam === "pending" ||
      statusParam === "published" ||
      statusParam === "rejected" ||
      statusParam === "unpublished"
        ? statusParam
        : undefined;

    const data = await listConsoleLibraryBooks({ page, pageSize, status, q: q?.trim() ? q.trim() : undefined });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

