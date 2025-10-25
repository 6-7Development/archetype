import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const rawUrl = process.env.DATABASE_URL;

// CRITICAL FIX: Add SSL parameters directly to connection string for drizzle-kit compatibility
// This ensures ALL database clients (app, drizzle-kit, etc.) use proper SSL config
let connectionString = rawUrl;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !rawUrl.includes('sslmode=')) {
  // Add SSL mode to connection string so drizzle-kit picks it up
  const separator = rawUrl.includes('?') ? '&' : '?';
  connectionString = `${rawUrl}${separator}sslmode=no-verify`;
  console.info('[db] ✅ Added sslmode=no-verify to connection string for production');
}

const parsed = new URL(rawUrl);
const maskedUrl = `${parsed.protocol}//${parsed.username ? "***@" : ""}${parsed.host}${parsed.pathname}`;

console.info(`[db] Environment: NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT}`);
console.info(`[db] Using DATABASE_URL: ${maskedUrl}`);

const poolConfig: any = {
  connectionString: connectionString,
  connectionTimeoutMillis: 5000,
};

// ALSO configure Pool SSL for runtime (belt and suspenders approach)
if (isProduction) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

export const pool = new Pool(poolConfig);

console.info(`[db] Pool config: connectionTimeoutMillis=5000, ssl=${isProduction ? 'enabled (rejectUnauthorized: false)' : 'disabled'}`);
console.info(`[db] SSL Configuration: ${JSON.stringify(poolConfig.ssl)}`);
console.info(`[db] Connection string includes SSL params: ${connectionString.includes('sslmode=')}`);

export const db = drizzle(pool, { schema });