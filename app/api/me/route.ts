import { NextResponse } from "next/server";

import { getUserAccessInfo } from "@/lib/auth/session";

export async function GET() {
  const info = await getUserAccessInfo();
  return NextResponse.json(info, { headers: { "Cache-Control": "no-store" } });
}

