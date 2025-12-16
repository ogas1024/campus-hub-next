import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { config } from "@/lib/config";

const globalForDb = globalThis as unknown as { __dbClient?: ReturnType<typeof postgres> };

const client = globalForDb.__dbClient ?? postgres(config.databaseUrl, { prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__dbClient = client;
}

export const db = drizzle(client);
