import { NextResponse } from "next/server";

import { requirePerm } from "@/lib/auth/permissions";
import { badRequest } from "@/lib/http/errors";
import { parseIntParam } from "@/lib/http/query";
import { getRequestContext, jsonError } from "@/lib/http/route";
import { createConsoleUserBodySchema } from "@/lib/modules/iam/users.schemas";
import { createConsoleUser, listConsoleUsers } from "@/lib/modules/iam/users.service";

export async function GET(request: Request) {
  try {
    const user = await requirePerm("campus:user:list");
    const { searchParams } = new URL(request.url);

    const page = parseIntParam(searchParams.get("page"), { defaultValue: 1, min: 1 });
    const pageSize = parseIntParam(searchParams.get("pageSize"), { defaultValue: 20, min: 1, max: 50 });

    const q = searchParams.get("q") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const statusValue =
      status === "pending_email_verification" ||
      status === "pending_approval" ||
      status === "active" ||
      status === "disabled" ||
      status === "banned"
        ? status
        : undefined;

    const roleId = searchParams.get("roleId") ?? undefined;
    const departmentId = searchParams.get("departmentId") ?? undefined;
    const positionId = searchParams.get("positionId") ?? undefined;

    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const sortByValue = sortBy === "updatedAt" || sortBy === "lastLoginAt" ? sortBy : "createdAt";
    const sortOrder = searchParams.get("sortOrder") ?? "desc";
    const sortOrderValue = sortOrder === "asc" ? "asc" : "desc";

    const data = await listConsoleUsers({
      actorUserId: user.id,
      page,
      pageSize,
      q,
      status: statusValue,
      roleId,
      departmentId,
      positionId,
      sortBy: sortByValue,
      sortOrder: sortOrderValue,
    });

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePerm("campus:user:create");
    const ctx = getRequestContext(request);

    const body = await request.json().catch(() => {
      throw badRequest("请求体必须为 JSON");
    });
    const parsed = createConsoleUserBodySchema.safeParse(body);
    if (!parsed.success) throw badRequest("参数校验失败", parsed.error.flatten());

    const data = await createConsoleUser({
      ...parsed.data,
      actor: { userId: user.id, email: user.email },
      request: ctx,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

