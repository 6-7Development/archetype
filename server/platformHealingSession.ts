import { WebSocketServer } from 'ws';

export interface RunSession {
  id: string;
  userId: string;
  issue: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  pausedFor?: { 
    type: 'write';
    path: string;
    content: string;
    diff: string;
  };
  messages: Array<{
    type: string;
    content: any;
    timestamp: Date;
  }>;
  createdAt: Date;
  changes: Array<{
    path: string;
    operation: 'create' | 'modify' | 'delete';
  }>;
}

class SessionManager {
  private sessions = new Map<string, RunSession>();
  private wss: WebSocketServer | null = null;

  setWebSocketServer(wss: WebSocketServer) {
    this.wss = wss;
  }

  create(userId: string, issue: string): RunSession {
    const sessionId = `heal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: RunSession = {
      id: sessionId,
      userId,
      issue,
      status: 'running',
      messages: [],
      createdAt: new Date(),
      changes: [],
    };

    this.sessions.set(sessionId, session);
    
    // Broadcast init event
    this.broadcast(sessionId, {
      type: 'heal:init',
      sessionId,
      issue,
      timestamp: new Date().toISOString(),
    });

    console.log(`[HEAL-SESSION] Created session ${sessionId} for user ${userId}`);
    return session;
  }

  get(sessionId: string): RunSession | undefined {
    return this.sessions.get(sessionId);
  }

  pause(sessionId: string, pendingWrite: { path: string; content: string; diff: string }) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'paused';
    session.pausedFor = {
      type: 'write',
      ...pendingWrite,
    };

    this.addMessage(sessionId, {
      type: 'heal:write-pending',
      path: pendingWrite.path,
      content: pendingWrite.content,
      diff: pendingWrite.diff,
      timestamp: new Date().toISOString(),
    });

    console.log(`[HEAL-SESSION] Paused session ${sessionId} for write approval: ${pendingWrite.path}`);
  }

  resume(sessionId: string, approved: boolean): { shouldContinue: boolean; pendingWrite?: any } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const pendingWrite = session.pausedFor;
    session.status = 'running';
    session.pausedFor = undefined;

    if (approved && pendingWrite) {
      this.addMessage(sessionId, {
        type: 'heal:approved',
        path: pendingWrite.path,
        timestamp: new Date().toISOString(),
      });

      session.changes.push({
        path: pendingWrite.path,
        operation: 'modify',
      });

      console.log(`[HEAL-SESSION] Approved write for ${pendingWrite.path}`);
      return { shouldContinue: true, pendingWrite };
    } else {
      this.addMessage(sessionId, {
        type: 'heal:rejected',
        path: pendingWrite?.path,
        timestamp: new Date().toISOString(),
      });

      console.log(`[HEAL-SESSION] Rejected write for ${pendingWrite?.path}`);
      return { shouldContinue: true };
    }
  }

  complete(sessionId: string, changes?: Array<{ path: string; operation: 'modify' | 'create' | 'delete' }>) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'completed';
    if (changes) {
      session.changes = changes;
    }

    this.addMessage(sessionId, {
      type: 'heal:completed',
      changes: session.changes,
      timestamp: new Date().toISOString(),
    });

    console.log(`[HEAL-SESSION] Completed session ${sessionId} with ${session.changes.length} changes`);
  }

  fail(sessionId: string, error: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'failed';

    this.addMessage(sessionId, {
      type: 'heal:error',
      error,
      timestamp: new Date().toISOString(),
    });

    console.log(`[HEAL-SESSION] Failed session ${sessionId}: ${error}`);
  }

  addMessage(sessionId: string, message: any) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const fullMessage = {
      ...message,
      timestamp: new Date(),
    };

    session.messages.push(fullMessage);
    this.broadcast(sessionId, message);
  }

  private broadcast(sessionId: string, message: any) {
    if (!this.wss) {
      console.warn('[HEAL-SESSION] WebSocket server not set, cannot broadcast');
      return;
    }

    const payload = JSON.stringify(message);

    this.wss.clients.forEach((client: any) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        // In production, filter by userId/sessionId
        client.send(payload);
      }
    });
  }

  cleanup(sessionId: string) {
    this.sessions.delete(sessionId);
    console.log(`[HEAL-SESSION] Cleaned up session ${sessionId}`);
  }

  // Cleanup old sessions (call periodically)
  cleanupOldSessions(maxAgeMs: number = 3600000) { // 1 hour default
    const now = Date.now();
    for (const [sessionId, session] of Array.from(this.sessions.entries())) {
      if (now - session.createdAt.getTime() > maxAgeMs) {
        this.cleanup(sessionId);
      }
    }
  }
}

export const sessionManager = new SessionManager();
