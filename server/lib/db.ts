import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import * as schema from './schema';

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

// Enhanced connection pooling configuration for optimal performance
const client = postgres(connectionString, {
  // Connection pool settings
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '25', 10), // Maximum connections in pool (increased from 20)
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30', 10), // Close idle connections after 30 seconds
  max_lifetime: parseInt(process.env.DB_MAX_LIFETIME || '1800', 10), // Close connections after 30 minutes
  connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10', 10), // Connection timeout in seconds
  
  // Query optimization settings
  prepare: false, // Disable prepared statements for better pool utilization with dynamic queries
  fetch_types: false, // Disable automatic type fetching to reduce overhead
  publications: 'alltables', // For logical replication if needed
  
  // Performance optimizations
  transform: {
    // Optimize undefined handling
    undefined: null,
  },
  
  // Connection retry settings
  connection: {
    application_name: process.env.APP_NAME || 'platform-app',
    // Enable TCP keepalive to detect broken connections
    ...((process.env.NODE_ENV === 'production') && {
      tcp_keepalive: true,
      tcp_keepalive_idle: 600,
      tcp_keepalive_interval: 30,
      tcp_keepalive_count: 3,
    }),
  },
  
  // Error handling and logging
  onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined,
  debug: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true',
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  
  // Additional performance settings
  types: {
    // Custom type parsing can be added here if needed
  },
});

// Create drizzle instance with query logging in development
export const db = drizzle(client, { 
  schema,
  logger: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true'
});

// Connection pool monitoring and health check
let connectionHealthCheck: NodeJS.Timeout | null = null;
let isShuttingDown = false;

// Health check function to monitor connection pool
const monitorConnectionHealth = () => {
  if (isShuttingDown) return;
  
  try {
    // Simple health check query
    client`SELECT 1 as health_check`.then(() => {
      if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DB === 'true') {
        console.log('Database connection pool healthy');
      }
    }).catch((error) => {
      console.error('Database health check failed:', error.message);
    });
  } catch (error) {
    console.error('Database health check error:', error);
  }
};

// Start health monitoring in production or when explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.DB_HEALTH_CHECK === 'true') {
  const healthCheckInterval = parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '30000', 10);
  connectionHealthCheck = setInterval(monitorConnectionHealth, healthCheckInterval);
}

// Enhanced graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, initiating graceful shutdown...`);
  isShuttingDown = true;
  
  // Clear health check interval
  if (connectionHealthCheck) {
    clearInterval(connectionHealthCheck);
    connectionHealthCheck = null;
  }
  
  try {
    console.log('Closing database connections...');
    await client.end({ timeout: 10 }); // 10 second timeout for graceful shutdown
    console.log('Database connections closed successfully');
  } catch (error) {
    console.error('Error during database shutdown:', error);
  } finally {
    process.exit(0);
  }
};

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions to prevent connection leaks
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled rejection:', reason);
  await gracefulShutdown('unhandledRejection');
});

// Query optimization helper functions
export const withTransaction = async <T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> => {
  return await db.transaction(fn);
};

// Connection pool statistics (for monitoring)
export const getConnectionStats = () => {
  if (process.env.NODE_ENV === 'development') {
    return {
      totalConnections: client.options.max,
      idleTimeout: client.options.idle_timeout,
      maxLifetime: client.options.max_lifetime,
      connectTimeout: client.options.connect_timeout,
    };
  }
  return null;
};

// Export client for advanced usage
export { client };

// Export database instance as default
export default db;