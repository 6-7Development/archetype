import type { WebSocketServer } from 'ws';
import { broadcastToUser, broadcastToProject } from '../websocket.ts';

// WebSocket server reference for live preview updates
let wss: WebSocketServer | null = null;

// Initialize WebSocket server reference
export function initializeLomuAIWebSocket(websocketServer: WebSocketServer) {
  wss = websocketServer;
  console.log('[LOMU-AI] WebSocket server initialized for live preview broadcasts');
}

// Wrapper for broadcastFileUpdate that provides wss context
export function broadcastFileUpdate(
  path: string, 
  operation: 'create' | 'modify' | 'delete', 
  targetContext: 'platform' | 'project' = 'platform',
  projectId: string | null = null,
  userId: string | null = null
) {
  // Call imported utility with wss context
  broadcastToUser(wss, userId, { type: 'file-change', file: { path, operation, targetContext, projectId } });
  if (projectId) {
    broadcastToProject(wss, projectId, { type: 'file-change', file: { path, operation, targetContext, projectId } });
  }
}
