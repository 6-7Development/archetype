/**
 * SSE Streaming module for LomuAI
 * Handles real-time event streaming to frontend with proper buffering prevention
 * Extracted from massive lomuChat.ts for maintainability
 */

import type { Response } from 'express';

const HEARTBEAT_INTERVAL_MS = 15000; // Every 15 seconds
const STREAM_TIMEOUT_MS = 300000; // 5 minutes

/**
 * Configure SSE headers to prevent buffering at multiple layers
 */
export function configureSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.setHeader('Content-Encoding', 'none'); // Prevent gzip buffering
  res.flushHeaders();
  console.log('[SSE] Headers configured and flushed');
}

/**
 * Send initial heartbeat to unblock fetch promise
 */
export function sendInitialHeartbeat(res: Response): void {
  res.write(': init\n\n');
  console.log('[SSE] Initial heartbeat sent');
}

/**
 * Create sendEvent function for streaming responses
 */
export function createEventSender(res: Response) {
  return (type: string, data: any) => {
    try {
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    } catch (error) {
      console.error(`[SSE] Failed to send event ${type}:`, error);
    }
  };
}

/**
 * Setup heartbeat to prevent connection timeout
 */
export function setupHeartbeat(res: Response): NodeJS.Timeout {
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
      console.log('[HEARTBEAT] Keepalive sent');
    } catch (error) {
      console.error('[HEARTBEAT] Failed to send keepalive:', error);
      clearInterval(heartbeat);
    }
  }, HEARTBEAT_INTERVAL_MS);

  console.log('[HEARTBEAT] Started (interval: 15s)');
  return heartbeat;
}

/**
 * Setup stream timeout with cleanup
 */
export function setupStreamTimeout(
  res: Response,
  sendEvent: (type: string, data: any) => void,
  messageId?: string
): NodeJS.Timeout {
  return setTimeout(() => {
    console.error('[STREAM] Timeout after 5 minutes - force closing');
    if (!res.writableEnded) {
      sendEvent('error', { message: '⏱️ Stream timeout after 5 minutes. Please try again.' });
      sendEvent('done', { messageId: messageId || 'timeout', error: true });
      res.end();
    }
  }, STREAM_TIMEOUT_MS);
}

/**
 * Setup TCP keep-alive on socket
 */
export function setupSocketKeepAlive(req: any): void {
  if (req.socket) {
    req.socket.setKeepAlive(true);
    console.log('[TCP] Keep-alive enabled');
  }
}

/**
 * Terminate stream gracefully
 */
export function terminateStream(
  res: Response,
  sendEvent: (type: string, data: any) => void,
  messageId: string,
  error?: string
): void {
  if (!res.writableEnded) {
    if (error) {
      sendEvent('error', { message: error });
    }
    sendEvent('done', { messageId, error: !!error });
    res.end();
    console.log(`[STREAM] Terminated${error ? ` with error: ${error}` : ' successfully'}`);
  }
}

/**
 * Emit structured section for collapsible UI
 */
export function emitSection(
  sendEvent: (type: string, data: any) => void,
  sectionId: string,
  sectionType: 'thinking' | 'tool' | 'text',
  phase: 'start' | 'update' | 'finish',
  content: string,
  metadata?: any
): void {
  const eventData = {
    sectionId,
    sectionType,
    title: metadata?.title || content.substring(0, 50),
    phase,
    timestamp: Date.now(),
    content,
    metadata,
  };
  sendEvent(`section_${phase}`, eventData);
}
