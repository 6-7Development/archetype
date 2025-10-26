import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const rawUrl = process.env.DATABASE_URL;
const parsed = new URL(rawUrl);
const maskedUrl = `${parsed.protocol}//${parsed.username ? "***@" : ""}${parsed.host}${parsed.pathname}`;

console.info(`[db] Environment: NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT}`);
console.info(`[db] Using DATABASE_URL: ${maskedUrl}`);

export const pool = new Pool({ 
  connectionString: rawUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
});

console.info(`[db] Pool config: connectionTimeoutMillis=5000, ssl=${process.env.NODE_ENV === 'production'}`);

export const db = drizzle(pool, { schema });
