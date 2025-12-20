import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { parseBooleanParam, parseTriStateBooleanParam } from "@/lib/http/query";
import { jsonError } from "@/lib/http/route";
import { requireUuid } from "@/lib/http/uuid";
import { exportMaterialZip, streamMaterialZip } from "@/lib/modules/materials/materials.service";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

function parseIsoDate(value: string | null) {
  if (!value) return undefined;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:material:export");
    const { id } = await params;
    const materialId = requireUuid(id, "id");

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || undefined;
    const statusParam = searchParams.get("status");
    const status =
      statusParam === "pending" || statusParam === "complete" || statusParam === "need_more" || statusParam === "approved" || statusParam === "rejected"
        ? statusParam
        : undefined;
    const missingRequired = parseTriStateBooleanParam(searchParams.get("missingRequired"));
    const from = parseIsoDate(searchParams.get("from"));
    const to = parseIsoDate(searchParams.get("to"));
    const departmentId = searchParams.get("departmentId")?.trim() || undefined;
    const includeUnsubmitted = parseBooleanParam(searchParams.get("includeUnsubmitted"), { defaultValue: false });

    const data = await exportMaterialZip({
      actorUserId: user.id,
      materialId,
      filters: { q, status, missingRequired, from, to, departmentId, includeUnsubmitted },
    });

    const { archive, fileName } = await streamMaterialZip({ fileName: data.fileName, manifest: data.manifest, entries: data.entries });
    const stream = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;

    return new NextResponse(stream, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
