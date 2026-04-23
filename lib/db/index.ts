import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { config } from "@/lib/config";

const globalForDb = globalThis as unknown as {
  __dbClient?: ReturnType<typeof postgres>;
  __db?: PostgresJsDatabase<Record<string, never>>;
};
const poolMaxRaw = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
const poolMax = Number.isFinite(poolMaxRaw) && poolMaxRaw > 0 ? poolMaxRaw : process.env.NODE_ENV === "production" ? 5 : 5;

const client = globalForDb.__dbClient ??
  postgres(config.databaseUrl, {
    prepare: false,
    max: poolMax,
    connect_timeout: 5,
    idle_timeout: 20,
  });

globalForDb.__dbClient = client;

export const db = globalForDb.__db ?? drizzle(client);

globalForDb.__db = db;
