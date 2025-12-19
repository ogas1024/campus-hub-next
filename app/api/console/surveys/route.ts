import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { parseBooleanParam, parseIntParam } from "@/lib/http/query";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { createSurveyDraftBodySchema } from "@/lib/modules/surveys/surveys.schemas";
import { createSurveyDraft, listConsoleSurveys } from "@/lib/modules/surveys/surveys.service";

export async function GET(request: Request) {
  try {
    const user = await requirePerm("campus:survey:list");
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });
    const q = searchParams.get("q") ?? undefined;

    const status = searchParams.get("status") ?? undefined;
    const statusValue = status === "draft" || status === "published" || status === "closed" ? status : undefined;

    const mine = parseBooleanParam(searchParams.get("mine"), { defaultValue: false });

    const data = await listConsoleSurveys({
      actorUserId: user.id,
      page,
      pageSize,
      q,
      status: statusValue,
      mine,
    });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePerm("campus:survey:create");
    const ctx = getRequestContext(request);

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = createSurveyDraftBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const created = await createSurveyDraft({
      actorUserId: user.id,
      body: {
        title: parsed.data.title,
        descriptionMd: parsed.data.descriptionMd ?? "",
        startAt: parsed.data.startAt,
        endAt: parsed.data.endAt,
        anonymousResponses: parsed.data.anonymousResponses,
        visibleAll: parsed.data.visibleAll,
        scopes: parsed.data.scopes,
      },
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

