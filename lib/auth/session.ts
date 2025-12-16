import { unauthorized } from "@/lib/http/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth/types";

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

