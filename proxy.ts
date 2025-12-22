/**
 * 用法：
 * - Next.js 16 的 `proxy.ts` 入口：在 Edge 侧刷新 Supabase 会话，并通过响应 Cookie 写回最新 token。
 * - 仅在请求包含 `sb-*` 会话 Cookie 时触发，避免匿名访问额外开销。
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseEnv } from "@/lib/supabase/env";

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });

  const hasSessionCookie = req
    .cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.value);
  if (!hasSessionCookie) {
    return res;
  }

  const supabase = createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          req.cookies.set(cookie.name, cookie.value);
        }

        res = NextResponse.next({ request: { headers: req.headers } });

        for (const cookie of cookiesToSet) {
          res.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  await supabase.auth.getUser();
  return res;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
