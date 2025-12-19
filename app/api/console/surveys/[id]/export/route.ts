import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { jsonError } from "@/lib/http/route";
import { exportSurveyCsv } from "@/lib/modules/surveys/surveys.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requirePerm("campus:survey:export");
    const { id } = await params;

    const { csv, fileName } = await exportSurveyCsv({ actorUserId: user.id, surveyId: id });
    const csvWithBom = `\ufeff${csv}`;

    return new NextResponse(csvWithBom, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}

