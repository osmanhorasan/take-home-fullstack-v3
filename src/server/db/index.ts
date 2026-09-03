import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";
import * as schema from "./schema";

config({ path: ".env" });

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

const globalForDb = globalThis as unknown as {
  postgres?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDb.postgres ??
  postgres(requiredEnv("DATABASE_URL"), {
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgres = sql;
}

export const db = drizzle(sql, { schema });
