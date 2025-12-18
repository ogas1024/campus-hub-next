import { NextResponse } from "next/server";

import { HttpError } from "@/lib/http/errors";

export type RequestContext = {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
};

function firstForwardedFor(value: string | null) {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

export function getRequestContext(request: Request): RequestContext {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const ip = firstForwardedFor(request.headers.get("x-forwarded-for")) ?? request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");
  return { requestId, ip, userAgent };
}

export function jsonError(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details ?? {} } },
      { status: err.status },
    );
  }

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "服务端错误", details: {} } },
    { status: 500 },
  );
}
