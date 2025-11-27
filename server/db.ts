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
  connectionTimeoutMillis: 30000, // 30 seconds (was 5s - too short for cloud DB)
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  statement_timeout: 60000, // 60 second query timeout
};

// ALSO configure Pool SSL for runtime (belt and suspenders approach)
if (isProduction) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

export const pool = new Pool(poolConfig);

console.info(`[db] Pool config: connectionTimeoutMillis=30000, max=20, ssl=${isProduction ? 'enabled (rejectUnauthorized: false)' : 'disabled'}`);
console.info(`[db] SSL Configuration: ${JSON.stringify(poolConfig.ssl)}`);
console.info(`[db] Connection string includes SSL params: ${connectionString.includes('sslmode=')}`);

export const db = drizzle(pool, { schema });

/**
 * Initialize RLS policies on database connection
 * This function is called once during application startup to ensure
 * all Row-Level Security policies are in place for multi-tenant isolation
 */
export async function initializeRLSPolicies() {
  try {
    const { initializeRLSPolicies: initRLS } = await import('./db/rls-policies');
    const result = await initRLS();
    console.info('[db] RLS policies initialized:', result);
    return result;
  } catch (error: any) {
    console.error('[db] Failed to initialize RLS policies:', error.message);
    // Don't throw - RLS policies are optional in development
    if (isProduction) {
      throw error;
    }
  }
}

// Initialize RLS policies on module load (after db connection)
// Wrapped in try-catch to allow graceful degradation
(async () => {
  try {
    // Small delay to ensure pool is ready
    await new Promise(resolve => setTimeout(resolve, 100));
    await initializeRLSPolicies();
  } catch (error) {
    console.warn('[db] RLS initialization warning (non-critical):', error);
  }
})().catch(err => {
  console.warn('[db] Failed to run RLS initialization:', err);
});