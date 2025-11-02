import type { Express } from 'express';
import type { Server } from 'http';
import type { WebSocketServer, WebSocket } from 'ws';
import { terminalService } from '../services/terminalService';
import { storage } from '../storage';
import crypto from 'crypto';
import url from 'url';

/**
 * Register terminal WebSocket routes
 * 
 * SECURITY HARDENING:
 * - Owner-only access (isOwner check during auth)
 * - Command allow-listing enforced in terminalService
 * - Workspace jailing prevents directory escape
 * 
 * This enables real-time command execution within project context
 * via WebSocket connections.
 * 
 * Terminal connections use /ws with query param: ?terminal=true&projectId=<id>
 */
export function registerTerminalRoutes(wss: WebSocketServer, httpServer: Server) {
  console.log('[TERMINAL-ROUTES] Registering WebSocket terminal handler');

  // Listen for all WebSocket connections on the main WSS
  wss.on('connection', (ws: any, request) => {
    const parsedUrl = url.parse(request.url || '', true);
    const query = parsedUrl.query;
    
    console.log(`[TERMINAL-DEBUG] Connection received, query:`, query);
    
    // Check if this is a terminal WebSocket connection
    if (query.terminal === 'true' && query.projectId) {
      const projectId = query.projectId as string;
      console.log(`[TERMINAL] ✓ Terminal connection detected for project: ${projectId}`);

      // Mark this WebSocket as a terminal connection
      ws.isTerminal = true;
      ws.terminalProjectId = projectId;

      // Setup terminal session
      setupTerminalSession(ws, projectId);
    }
  });
}

/**
 * Setup a terminal session for a WebSocket connection
 */
function setupTerminalSession(ws: any, projectId: string) {
  console.log(`[TERMINAL] New terminal connection for project ${projectId}`);

  // Session state
  let sessionId: string | null = null;
  let userId: string | null = null;
  let authenticated = false;

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Terminal WebSocket connected. Send { type: "auth", userId: "YOUR_USER_ID" } to authenticate.',
  }));

  // Handle incoming messages
  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);

      // Handle authentication
      if (data.type === 'auth') {
        if (!data.userId) {
          ws.send(JSON.stringify({
            type: 'error',
            data: 'Missing userId in auth message',
          }));
          return;
        }

        // SECURITY: Check if user is platform owner
        try {
          const user = await storage.getUser(data.userId);
          if (!user) {
            ws.send(JSON.stringify({
              type: 'error',
              data: 'User not found',
            }));
            ws.close();
            return;
          }

          if (!user.isOwner) {
            ws.send(JSON.stringify({
              type: 'error',
              data: 'Terminal access restricted to platform owner only',
            }));
            ws.close();
            return;
          }
        } catch (error: any) {
          console.error('[TERMINAL] Error checking user ownership:', error);
          ws.send(JSON.stringify({
            type: 'error',
            data: 'Authentication failed',
          }));
          ws.close();
          return;
        }

        userId = data.userId;
        authenticated = true;
        sessionId = crypto.randomUUID();

        console.log(`[TERMINAL] Authenticated owner ${userId} for project ${projectId}`);

        // Create terminal session
        try {
          // Type guard: userId is guaranteed to be non-null here
          if (!userId) {
            throw new Error('User ID is required');
          }
          
          await terminalService.createSession(
            sessionId,
            projectId,
            userId,
            ws
          );

          ws.send(JSON.stringify({
            type: 'auth_success',
            sessionId,
            userId,
            projectId,
          }));
        } catch (error: any) {
          console.error('[TERMINAL] Failed to create session:', error);
          ws.send(JSON.stringify({
            type: 'error',
            data: `Failed to create terminal session: ${error.message}`,
          }));
          authenticated = false;
          sessionId = null;
          userId = null;
        }
        return;
      }

      // All other commands require authentication
      if (!authenticated || !sessionId) {
        ws.send(JSON.stringify({
          type: 'error',
          data: 'Not authenticated. Send { type: "auth", userId: "YOUR_USER_ID" } first.',
        }));
        return;
      }

      // Handle command execution
      if (data.type === 'execute') {
        if (!data.command || typeof data.command !== 'string') {
          ws.send(JSON.stringify({
            type: 'error',
            data: 'Missing or invalid command',
          }));
          return;
        }

        console.log(`[TERMINAL] Executing command: ${data.command}`);
        await terminalService.executeCommand(sessionId, data.command);
        return;
      }

      // Handle kill request
      if (data.type === 'kill') {
        console.log(`[TERMINAL] Killing process in session ${sessionId}`);
        terminalService.killProcess(sessionId);
        ws.send(JSON.stringify({
          type: 'killed',
          message: 'Process terminated',
        }));
        return;
      }

      // Handle history request
      if (data.type === 'history') {
        const history = terminalService.getHistory(sessionId);
        ws.send(JSON.stringify({
          type: 'history',
          commands: history,
        }));
        return;
      }

      // Handle ping
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // Unknown message type
      ws.send(JSON.stringify({
        type: 'error',
        data: `Unknown message type: ${data.type}`,
      }));

    } catch (error: any) {
      console.error('[TERMINAL] Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: `Error processing message: ${error.message}`,
      }));
    }
  });

  // Handle connection close
  ws.on('close', () => {
    console.log(`[TERMINAL] Connection closed for project ${projectId}`);
    
    if (sessionId) {
      terminalService.cleanup(sessionId);
    }
  });

  // Handle connection errors
  ws.on('error', (error: Error) => {
    console.error(`[TERMINAL] WebSocket error for project ${projectId}:`, error);
    
    if (sessionId) {
      terminalService.cleanup(sessionId);
    }
  });
}
