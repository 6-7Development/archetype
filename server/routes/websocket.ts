import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "../storage";

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
        
        // Handle ping
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
        
        // Handle project subscription
        if (data.type === 'subscribe_project') {
          ws.projectId = data.projectId;
          console.log(`📂 WebSocket subscribed to project: ${ws.projectId}`);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
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
