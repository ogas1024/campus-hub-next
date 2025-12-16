import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import type { AppUser } from "@/lib/auth/types";

export async function requirePortalUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

