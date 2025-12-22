import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { config } from "@/lib/config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "";
          if (message.includes("Cookies can only be modified in a Server Action or Route Handler")) {
            // Next.js 在 Server Component 渲染阶段不允许写入 Cookie（仅允许在 Server Action / Route Handler / Middleware）。
            // 此处忽略写入失败，避免 SSR 直接报错；会话刷新与 Cookie 写回由 Middleware 负责。
            return;
          }
          throw err;
        }
      },
    },
  });
}
