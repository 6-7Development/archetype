/**
 * GEMINI ORCHESTRATOR - INTEGRATION EXAMPLE
 * 
 * This file demonstrates how to integrate the GeminiOrchestrator
 * into existing routes (e.g., lomuChat.ts) with WebSocket streaming.
 */

import { createGeminiOrchestrator, type StreamEvent, type ExecutionResult } from './geminiOrchestrator';

// Example placeholder - In production, import: import { broadcastToUser } from '../routes/websocket';
// and pass wss as first argument: broadcastToUser(wss, userId, data)
function broadcastToUser(_userId: string, _data: any) {
  // Placeholder for examples - replace with actual WebSocket broadcast
}

/**
 * Example 1: Simple Usage with Console Logging
 */
export async function simpleExample() {
  const orchestrator = createGeminiOrchestrator(
    process.cwd(), // Working directory
    'user-123', // User ID
    'session-456', // Session ID
    (event: StreamEvent) => {
      // Simple console logging
      console.log('[ORCHESTRATOR]', event.type, event.content || '');
    }
  );

  const result = await orchestrator.execute(
    'Create a React button component with TypeScript and Tailwind CSS'
  );

  console.log('Execution Result:', result);
}

/**
 * Example 2: Integration with WebSocket Streaming
 * (Use this in lomuChat.ts or similar routes)
 */
export async function websocketStreamingExample(
  userId: string,
  sessionId: string,
  userRequest: string
) {
  const orchestrator = createGeminiOrchestrator(
    process.cwd(),
    userId,
    sessionId,
    (event: StreamEvent) => {
      // Broadcast events to user via WebSocket
      broadcastToUser(userId, {
        type: 'orchestrator_event',
        event: event.type,
        content: event.content,
        task: event.task,
        tool: event.tool,
        args: event.args,
        filePath: event.filePath,
        operation: event.operation,
        validationResult: event.validationResult,
        error: event.error,
      });

      // Also log to console for debugging
      console.log(`[ORCHESTRATOR-${userId}]`, event.type, event.content || '');
    }
  );

  try {
    const result = await orchestrator.execute(userRequest);
    
    // Broadcast completion
    broadcastToUser(userId, {
      type: 'orchestrator_complete',
      result: result,
    });

    return result;
  } catch (error: any) {
    console.error('[ORCHESTRATOR] Fatal error:', error);
    
    broadcastToUser(userId, {
      type: 'orchestrator_error',
      error: error.message,
    });

    throw error;
  }
}

/**
 * Example 3: Integration into Express Route
 * Add this to server/routes/lomuChat.ts
 */
export const orchestratorRouteExample = `
// In server/routes/lomuChat.ts

import { createGeminiOrchestrator } from '../services/geminiOrchestrator';
import { broadcastToUser } from './websocket';

// Inside your chat route handler:
router.post('/api/orchestrator/execute', isAuthenticated, async (req, res) => {
  const userId = req.user!.id;
  const { request, sessionId } = req.body;

  try {
    const orchestrator = createGeminiOrchestrator(
      process.cwd(),
      userId,
      sessionId || 'default',
      (event) => {
        // Stream events to user via WebSocket
        broadcastToUser(userId, {
          type: 'orchestrator_stream',
          event,
        });
      }
    );

    const result = await orchestrator.execute(request);

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('[ORCHESTRATOR-ROUTE] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
`;

/**
 * Example 4: Frontend Integration (React)
 */
export const frontendExample = `
// In client/src/components/orchestrator-chat.tsx

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket-stream';

export function OrchestratorChat() {
  const [input, setInput] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Connect to WebSocket
  const ws = useWebSocket('ws://localhost:5000/ws');

  useEffect(() => {
    if (!ws) return;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'orchestrator_stream') {
        setEvents(prev => [...prev, data.event]);
      } else if (data.type === 'orchestrator_complete') {
        setIsExecuting(false);
        console.log('Execution complete:', data.result);
      }
    };
  }, [ws]);

  const executeRequest = async () => {
    if (!input.trim()) return;

    setIsExecuting(true);
    setEvents([]);

    try {
      await fetch('/api/orchestrator/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: input,
          sessionId: 'session-' + Date.now(),
        }),
      });
    } catch (error) {
      console.error('Execution error:', error);
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4">
        {events.map((event, i) => (
          <div key={i} className="mb-2">
            <span className="font-mono text-sm">
              {event.content || \`[\${event.type}]\`}
            </span>
          </div>
        ))}
      </div>

      <div className="p-4 border-t">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && executeRequest()}
          placeholder="Ask me to build something..."
          disabled={isExecuting}
          className="w-full px-4 py-2 border rounded"
        />
        <button
          onClick={executeRequest}
          disabled={isExecuting || !input.trim()}
          className="mt-2 px-6 py-2 bg-blue-500 text-white rounded"
        >
          {isExecuting ? 'Executing...' : 'Execute'}
        </button>
      </div>
    </div>
  );
}
`;

/**
 * Example 5: Advanced Usage with Custom Validation
 */
export async function advancedExample(userId: string) {
  const orchestrator = createGeminiOrchestrator(
    process.cwd(),
    userId,
    'advanced-session',
    (event: StreamEvent) => {
      // Custom event handling
      switch (event.type) {
        case 'task_start':
          console.log(`📋 Starting task: ${event.task?.description}`);
          break;

        case 'file_operation':
          console.log(`✏️ File operation: ${event.operation} on ${event.filePath}`);
          break;

        case 'validation':
          if (event.validationResult) {
            console.log('✅ Validation passed');
          } else {
            console.log('❌ Validation failed - will retry');
          }
          break;

        case 'complete':
          console.log('🎉 All tasks completed!');
          break;

        case 'error':
          console.error('❌ Error:', event.error);
          break;

        default:
          // Stream text content
          if (event.content) {
            process.stdout.write(event.content);
          }
      }
    }
  );

  const result = await orchestrator.execute(
    'Build a complete authentication system with login, signup, and password reset'
  );

  return result;
}

/**
 * Example Usage in Real Project
 */
export const realWorldUsage = `
// Example: Building a feature using the orchestrator

import { createGeminiOrchestrator } from '@/server/services/geminiOrchestrator';

async function buildDashboard(userId: string) {
  const orchestrator = createGeminiOrchestrator(
    process.cwd(),
    userId,
    'dashboard-build',
    (event) => {
      // Real-time progress updates to frontend
      broadcastToUser(userId, {
        type: 'build_progress',
        event,
      });
    }
  );

  const result = await orchestrator.execute('Build a dashboard page with the following features: 1. User stats cards, 2. Charts, 3. Activity feed, 4. Quick actions. Use TypeScript, React, Tailwind CSS, and shadcn/ui.');

  if (result.success) {
    console.log('Dashboard built successfully!');
    console.log('Files modified:', result.filesModified);
  } else {
    console.error('Build failed:', result.errors);
  }

  return result;
}
`;
