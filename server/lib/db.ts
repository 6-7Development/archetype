import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import * as schema from './schema';

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

// Connection pooling configuration to prevent resource exhaustion
const client = postgres(connectionString, {
  max: 20,          // Maximum connections in pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  max_lifetime: 60 * 30, // Close connections after 30 minutes
  connect_timeout: 10,   // Connection timeout
  prepare: false,        // Disable prepared statements for better pool utilization
});

export const db = drizzle(client, { schema });

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  await client.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database connections...');
  await client.end();
  process.exit(0);
});

export { client };