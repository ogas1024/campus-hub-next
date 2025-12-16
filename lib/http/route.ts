import { NextResponse } from "next/server";

import { HttpError } from "@/lib/http/errors";

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

