import "server-only";

import { SupabaseStorageAdapter } from "@/lib/storage/supabaseStorageAdapter";

export const storageAdapter = new SupabaseStorageAdapter();

