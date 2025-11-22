import type { Response } from 'express';
import type { WebSocketServer } from 'ws';
import { broadcastToUser } from '../websocket.ts';
import { nanoid } from 'nanoid';

export function configureSSEHeaders(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

export function sendInitialHeartbeat(res: Response) {
  res.write('data: { "type": "heartbeat", "message": "LomuAI stream active" }\n\n');
}

export function createEventSender(res: Response) {
  return (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };
}

export function setupHeartbeat(res: Response) {
  const heartbeatInterval = setInterval(() => {
    res.write('data: { "type": "heartbeat" }\n\n');
  }, 15000); // Send heartbeat every 15 seconds
  return heartbeatInterval;
}

export function setupStreamTimeout(res: Response, sendEvent: (type: string, data: any) => void) {
  const streamTimeoutId = setTimeout(() => {
    console.warn('[LOMU-AI-STREAM] Stream timed out after 10 minutes of inactivity.');
    sendEvent('error', { message: 'Stream timed out due to inactivity.' });
    res.end();
  }, 600000); // 10 minutes
  return streamTimeoutId;
}

export function setupSocketKeepAlive(req: any) {
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true, 15000); // Keep alive every 15 seconds
}

export function terminateStream(res: Response, sendEvent: (type: string, data: any) => void, messageId: string, errorMessage?: string) {
  if (errorMessage) {
    sendEvent('error', { message: errorMessage });
  }
  sendEvent('done', { messageId });
  res.end();
}

export function emitSection(sendEvent: (type: string, data: any) => void, title: string, content: string, category: 'thinking' | 'action' | 'result', messageId: string) {
  const progressId = nanoid();
  sendEvent('assistant_progress', {
    messageId,
    progressId,
    content: `**${title}**\n\n${content}`,
    category
  });
}

export function broadcastFileUpdate(wss: WebSocketServer | null, path: string, operation: 'create' | 'modify' | 'delete', targetContext: 'platform' | 'project' = 'platform', projectId: string | null = null, userId: string | null = null) {
  if (wss) {
    broadcastToUser(wss, userId, {
      type: 'file_change',
      file: { path, operation },
      targetContext,
      projectId,
      userId,
      timestamp: new Date().toISOString()
    });
  }
}

export function mapDatabaseStatusToRunState(dbStatus: string): 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' {
  switch (dbStatus) {
    case 'pending':
      return 'pending';
    case 'in_progress':
      return 'running';
    case 'completed':
      return 'completed';
    case 'completed_pending_review':
      return 'completed'; // Treat as completed for run state
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}
