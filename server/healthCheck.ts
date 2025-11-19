/**
 * P1-GAP-2: Lightweight backend-only health check script
 * Used by codeValidator to verify server can boot without Vite
 */

import express from 'express';

const app = express();
const PORT = process.env.PORT || 5001;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const server = app.listen(PORT, () => {
  console.log(`[HEALTH-CHECK] Server listening on port ${PORT}`);
});

// Handle cleanup
process.on('SIGTERM', () => {
  console.log('[HEALTH-CHECK] Received SIGTERM, shutting down...');
  server.close(() => {
    console.log('[HEALTH-CHECK] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[HEALTH-CHECK] Received SIGINT, shutting down...');
  server.close(() => {
    console.log('[HEALTH-CHECK] Server closed');
    process.exit(0);
  });
});
