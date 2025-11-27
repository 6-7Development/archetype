import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { storage } from "../storage.ts";
import { lomuAIBrain } from "../services/lomuAIBrain.ts";
import { sessionStore } from "../universalAuth.ts";
import cookieSignature from "cookie-signature";

// ARCHITECTURE FIX: Import session store singleton from universalAuth.ts
// This ensures HTTP and WebSocket share the SAME session store instance
// ✅ Single PostgreSQL connection pool
// ✅ Synchronized session data between HTTP and WebSocket
// ✅ No duplicate session stores

/**
 * Parse cookies from HTTP header
 * @param cookieHeader Cookie header string
 * @returns Object mapping cookie names to values
 */
function parseCookie(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=');
    if (name && value) {
      cookies[name.trim()] = decodeURIComponent(value.trim());
    }
  });
  
  return cookies;
}

/**
 * SECURITY: Validate Express session from WebSocket upgrade request
 * Uses session store's get() method to properly validate sessions with signing,
 * deserialization, and expiry checks - reusing Express session infrastructure
 * @param req WebSocket upgrade request
 * @returns Validated userId or null if session is invalid/missing
 */
async function validateSessionFromRequest(req: IncomingMessage): Promise<string | null> {
  try {
    // 1. Parse cookie from request headers
    const cookies = parseCookie(req.headers.cookie);
    const sessionCookie = cookies['connect.sid'];
    
    if (!sessionCookie) {
      console.log('[WS-AUTH] ❌ No session cookie found in request');
      return null;
    }
    
    // 2. SECURITY: Verify cookie signature before accepting sessionId
    // Cookie format: s:sessionId.signature (signed by SESSION_SECRET)
    if (!sessionCookie.startsWith('s:')) {
      console.log('[WS-AUTH] ❌ Session cookie missing signature prefix');
      return null;
    }
    
    // Unsign cookie with SESSION_SECRET to verify HMAC signature
    const unsignedValue = cookieSignature.unsign(sessionCookie.slice(2), process.env.SESSION_SECRET!);
    
    if (unsignedValue === false) {
      console.error('🚫 [WS-SECURITY] Tampered session cookie detected - signature verification failed');
      return null;
    }
    
    // FIX 2: Extract bare session ID (split on final '.' to remove signature)
    // The unsignedValue may still contain the session ID plus signature: "sessionId.signature"
    // We need just the session ID part for the lookup key
    const parts = (unsignedValue as string).split('.');
    const sessionId = parts[0]; // Just the session ID, no signature
    
    if (!sessionId || sessionId.length === 0) {
      console.log('[WS-AUTH] ❌ Invalid session ID after extraction');
      return null;
    }
    
    console.log(`[WS-AUTH] 🔓 Session cookie unsigned successfully, session ID: ${sessionId.substring(0, 8)}...`);
    
    // 3. Use session store's get() method - handles signing, deserialization, and expiry automatically
    return new Promise((resolve) => {
      sessionStore.get(sessionId, (err, session) => {
        if (err) {
          console.error('[WS-AUTH] ❌ Session store error:', err);
          resolve(null);
          return;
        }
        
        if (!session) {
          console.log('[WS-AUTH] ❌ Session not found or expired');
          resolve(null);
          return;
        }
        
        // Extract userId from Passport.js session structure
        // Type assertion needed as express-session doesn't know about passport extension
        const userId = (session as any).passport?.user;
        
        if (!userId) {
          console.log('[WS-AUTH] ❌ No user ID found in session data');
          resolve(null);
          return;
        }
        
        console.log(`[WS-AUTH] ✅ Session validated successfully for userId: ${userId}`);
        resolve(userId);
      });
    });
  } catch (error) {
    console.error('[WS-AUTH] ❌ Session validation error:', error);
    return null;
  }
}

export function setupWebSocket(app: Express): { httpServer: Server, wss: WebSocketServer } {
  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  console.log('📡 WebSocket server initialized at /ws');

  // WebSocket connection handler with SESSION AUTHENTICATION
  wss.on('connection', async (ws: any, req: IncomingMessage) => {
    // SECURITY FIX: Validate session BEFORE accepting connection
    const validatedUserId = await validateSessionFromRequest(req);
    
    if (!validatedUserId) {
      console.error('🚫 [WS-SECURITY] Unauthenticated connection attempt - terminating');
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Authentication required. Please log in to establish WebSocket connection.'
      }));
      ws.terminate();
      return;
    }
    
    // Set VALIDATED userId (server-side only - NEVER trust client input)
    ws.userId = validatedUserId;
    ws.isAuthenticated = true;
    ws.isAlive = true;
    
    // Parse URL to detect terminal mode
    const url = new URL(req.url || '', 'http://localhost');
    const isTerminal = url.searchParams.get('terminal') === 'true';
    const projectId = url.searchParams.get('projectId');
    
    ws.isTerminal = isTerminal;
    ws.projectId = projectId;
    
    console.log(`✅ WebSocket authenticated connection established for user: ${ws.userId}${isTerminal ? ' (TERMINAL MODE)' : ''}${projectId ? ` project: ${projectId}` : ''}`);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Send welcome message for terminal connections
    if (isTerminal) {
      ws.send(JSON.stringify({
        type: 'welcome',
        message: '🔌 LomuAI Terminal Ready\nType commands to interact with your project...'
      }));
      console.log(`[TERMINAL] Welcome message sent for user: ${ws.userId}`);
    }

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        // SECURITY: Reject client attempts to override authenticated userId
        if (data.type === 'auth') {
          // Check if client is trying to spoof userId
          if (data.userId && data.userId !== ws.userId) {
            console.error(`🚫 [WS-SECURITY] SPOOFING ATTEMPT DETECTED!`);
            console.error(`  Session userId: ${ws.userId}`);
            console.error(`  Claimed userId: ${data.userId}`);
            console.error(`  Remote address: ${req.socket.remoteAddress}`);
            
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Authentication mismatch - connection terminated for security violation'
            }));
            ws.terminate();
            return;
          }
          
          // Send confirmation with server-validated userId
          ws.send(JSON.stringify({
            type: 'auth_success',
            userId: ws.userId
          }));
          console.log(`✅ [WS] Auth confirmation sent for userId: ${ws.userId}`);
        }
        
        // SECURITY: Handle session registration with validated userId only
        if (data.type === 'register-session') {
          // Check if client is trying to spoof userId
          if (data.userId && data.userId !== ws.userId) {
            console.error(`🚫 [WS-SECURITY] SPOOFING ATTEMPT in register-session!`);
            console.error(`  Session userId: ${ws.userId}`);
            console.error(`  Claimed userId: ${data.userId}`);
            console.error(`  Remote address: ${req.socket.remoteAddress}`);
            
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Authentication mismatch - connection terminated for security violation'
            }));
            ws.terminate();
            return;
          }
          
          // Use server-validated userId (NEVER trust client input)
          ws.sessionId = data.sessionId;
          
          // Get or create session in brain (must create to register WebSocket)
          const session = await lomuAIBrain.getOrCreateSession({
            userId: ws.userId, // Use validated userId from session
            sessionId: ws.sessionId,
            targetContext: data.targetContext || 'project',
            projectId: data.projectId,
          });
          
          // Register WebSocket connection with brain
          lomuAIBrain.registerWebSocket(ws.userId, ws.sessionId, ws, `project_${ws.sessionId}`);
          
          console.log(`✅ [WS] Session registered: userId=${ws.userId}, sessionId=${ws.sessionId}`);
          
          // Send confirmation with server-validated userId
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

        // Handle terminal command execution
        if (data.type === 'execute') {
          const command = data.command;
          console.log(`[TERMINAL] Executing command: ${command} for user: ${ws.userId}`);
          
          // Basic terminal command handling
          if (!command || command.trim().length === 0) {
            ws.send(JSON.stringify({
              type: 'error',
              data: 'Command cannot be empty'
            }));
            return;
          }

          // Simulate command execution with realistic output
          try {
            // For now, provide mock output for common commands
            let output = '';
            
            if (command.includes('ls') || command.includes('dir')) {
              output = 'index.html\nmain.js\nstyles.css\npackage.json';
            } else if (command.includes('pwd')) {
              output = '/projects/' + (data.projectId || 'project');
            } else if (command.includes('npm install')) {
              output = 'npm notice packages installed successfully';
            } else if (command.includes('npm run')) {
              output = 'Build completed successfully!';
            } else {
              output = `Command output: ${command}`;
            }

            ws.send(JSON.stringify({
              type: 'output',
              data: output
            }));

            ws.send(JSON.stringify({
              type: 'command_complete'
            }));
          } catch (error: any) {
            ws.send(JSON.stringify({
              type: 'error',
              data: error.message || 'Command execution failed'
            }));
          }
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

/**
 * Broadcast message to specific user
 * 
 * 🔧 BUG FIX: Now returns boolean to indicate if message was delivered to any clients.
 * This fixes the issue where requestApproval would stall for offline users.
 * 
 * @param wss - WebSocket server instance
 * @param userId - User ID to broadcast to
 * @param data - Data to send (will be JSON stringified)
 * @returns true if message was delivered to at least one client, false if user is offline
 */
export function broadcastToUser(wss: WebSocketServer, userId: string, data: any): boolean {
  let delivered = false;
  let clientCount = 0;
  
  wss.clients.forEach((client: any) => {
    if (client.readyState === WebSocket.OPEN && client.userId === userId) {
      try {
        client.send(JSON.stringify(data));
        delivered = true;
        clientCount++;
      } catch (error: any) {
        console.error(`[WS-BROADCAST] Failed to send to client for user ${userId}:`, error.message);
      }
    }
  });
  
  if (delivered) {
    console.log(`[WS-BROADCAST] ✅ Message delivered to ${clientCount} client(s) for user ${userId}`);
  } else {
    console.warn(`[WS-BROADCAST] ⚠️ No active WebSocket clients found for user ${userId}`);
  }
  
  return delivered;
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
