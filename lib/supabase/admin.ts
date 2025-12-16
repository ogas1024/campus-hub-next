import "server-only";

import { createClient } from "@supabase/supabase-js";

import { config } from "@/lib/config";

export function createSupabaseAdminClient() {
  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

