import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/errors";
import { jsonError } from "@/lib/http/route";
import { submitVoteResponseBodySchema } from "@/lib/modules/votes/votes.schemas";
import { submitVoteResponse } from "@/lib/modules/votes/votes.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });

    const parsed = submitVoteResponseBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await submitVoteResponse({ userId: user.id, voteId: id, body: parsed.data });
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

