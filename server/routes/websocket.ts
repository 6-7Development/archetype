import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "../storage.ts";
import { lomuAIBrain } from "../services/lomuAIBrain.ts";

export function setupWebSocket(app: Express): { httpServer: Server, wss: WebSocketServer } {
  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  console.log('📡 WebSocket server initialized at /ws');

  // WebSocket connection handler
  wss.on('connection', (ws: any) => {
    console.log('✅ WebSocket client connected');
    
    ws.userId = null; // Will be set after authentication
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        // Handle authentication
        if (data.type === 'auth') {
          // Validate userId (in production, verify with session/token)
          ws.userId = data.userId;
          console.log(`🔐 WebSocket authenticated for user: ${ws.userId}`);
          
          // Send confirmation
          ws.send(JSON.stringify({
            type: 'auth_success',
            userId: ws.userId
          }));
        }
        
        // Handle session registration (for AI streaming)
        if (data.type === 'register-session') {
          ws.userId = data.userId || 'anonymous';
          ws.sessionId = data.sessionId;
          
          // Get or create session in brain (must create to register WebSocket)
          const session = await lomuAIBrain.getOrCreateSession({
            userId: ws.userId,
            sessionId: ws.sessionId,
            targetContext: data.targetContext || 'project',
            projectId: data.projectId,
          });
          
          // Register WebSocket connection with brain
          lomuAIBrain.registerWebSocket(ws.userId, ws.sessionId, ws, `project_${ws.sessionId}`);
          
          console.log(`📡 [WS] Session registered: userId=${ws.userId}, sessionId=${ws.sessionId}`);
          
          // Send confirmation
          ws.send(JSON.stringify({
            type: 'session-registered',
            sessionId: ws.sessionId,
            userId: ws.userId
          }));
        }
        
        // Handle ping
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
        
        // Handle project subscription with AUTHORIZATION CHECK
        if (data.type === 'subscribe_project') {
          // SECURITY FIX: Verify user has access to requested project
          if (!ws.userId) {
            console.error(`🚫 [WS-SECURITY] Unauthorized subscribe_project attempt (no userId)`);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Authentication required to subscribe to projects'
            }));
            ws.terminate(); // Severe connection on tampering attempt
            return;
          }
          
          const requestedProjectId = data.projectId;
          if (!requestedProjectId) {
            console.error(`🚫 [WS-SECURITY] Invalid subscribe_project request (no projectId)`);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid project subscription request'
            }));
            return;
          }
          
          // Verify project ownership/access
          try {
            const project = await storage.getProject(requestedProjectId, ws.userId);
            if (!project) {
              console.error(`🚫 [WS-SECURITY] Unauthorized subscribe_project attempt: userId=${ws.userId}, projectId=${requestedProjectId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Project not found or access denied'
              }));
              ws.terminate(); // Severe connection on unauthorized access attempt
              return;
            }
            
            // Authorization successful - allow subscription
            ws.projectId = requestedProjectId;
            console.log(`✅ [WS] Authorized project subscription: userId=${ws.userId}, projectId=${ws.projectId}`);
            ws.send(JSON.stringify({
              type: 'project_subscribed',
              projectId: ws.projectId
            }));
          } catch (error: any) {
            console.error(`❌ [WS-SECURITY] Project authorization check failed:`, error.message);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to verify project access'
            }));
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      // Unregister WebSocket from brain (pass ws instance to prevent stale unregister)
      if (ws.userId && ws.sessionId) {
        lomuAIBrain.unregisterWebSocket(ws.userId, ws.sessionId, ws);
      }
      
      console.log(`❌ WebSocket client disconnected${ws.userId ? ` (user: ${ws.userId})` : ''}`);
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Heartbeat to detect disconnected clients
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        console.log(`💀 Terminating dead WebSocket connection${ws.userId ? ` (user: ${ws.userId})` : ''}`);
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // Check every 30 seconds

  // Cleanup on server close
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    console.log('📡 WebSocket server closed');
  });

  return { httpServer, wss };
}

// Utility function to broadcast to specific user
export function broadcastToUser(wss: WebSocketServer, userId: string, data: any) {
  wss.clients.forEach((client: any) => {
    if (client.readyState === WebSocket.OPEN && client.userId === userId) {
      client.send(JSON.stringify(data));
    }
  });
}

// Utility function to broadcast to specific project
export function broadcastToProject(wss: WebSocketServer, projectId: string, data: any) {
  wss.clients.forEach((client: any) => {
    if (client.readyState === WebSocket.OPEN && client.projectId === projectId) {
      client.send(JSON.stringify(data));
    }
  });
}

// Utility function to broadcast to all connected clients
export function broadcastToAll(wss: WebSocketServer, data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
