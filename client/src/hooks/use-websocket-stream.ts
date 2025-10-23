import { useEffect, useRef, useState, useCallback } from 'react';

interface StreamMessage {
  type: 'ai-status' | 'ai-chunk' | 'ai-thought' | 'ai-action' | 'ai-complete' | 'ai-error' | 'session-registered' | 'file_status' | 'file_summary';
  commandId?: string;
  status?: string;
  message?: string;
  content?: string;
  thought?: string;
  action?: string;
  step?: number;
  totalSteps?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  error?: string;
  sessionId?: string;
  filename?: string;
  language?: string;
  filesChanged?: number;
  linesAdded?: number;
  linesRemoved?: number;
}

interface StreamState {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  currentStatus: string;
  currentThought: string;
  currentAction: string;
  currentStep: number;
  totalSteps: number;
  fullMessage: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  } | null;
  error: string | null;
  currentFile: {
    action: string;
    filename: string;
    language: string;
  } | null;
  fileSummary: {
    filesChanged: number;
    linesAdded: number;
    linesRemoved?: number;
  } | null;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

export function useWebSocketStream(sessionId: string, userId: string = 'anonymous') {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const shouldReconnectRef = useRef<boolean>(true);
  
  const [streamState, setStreamState] = useState<StreamState>({
    isConnected: false,
    isReconnecting: false,
    reconnectAttempt: 0,
    currentStatus: '',
    currentThought: '',
    currentAction: '',
    currentStep: 0,
    totalSteps: 12,
    fullMessage: '',
    usage: null,
    error: null,
    currentFile: null,
    fileSummary: null,
  });

  const calculateBackoff = useCallback((attempt: number): number => {
    // Exponential backoff with jitter: delay = min(max_delay, base * 2^attempt + random)
    const exponentialDelay = Math.min(
      MAX_RECONNECT_DELAY,
      BASE_RECONNECT_DELAY * Math.pow(2, attempt)
    );
    // Add jitter (random 0-1000ms) to prevent thundering herd
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }, []);

  const connect = useCallback(() => {
    // Don't connect if we're already connected or exceeding max attempts
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setStreamState(prev => ({
        ...prev,
        error: 'Maximum reconnection attempts reached. Please refresh the page.',
        isReconnecting: false,
      }));
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      
      console.log('🔌 Attempting WebSocket connection to:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        reconnectAttemptsRef.current = 0; // Reset on successful connection
        setStreamState(prev => ({ 
          ...prev, 
          isConnected: true, 
          isReconnecting: false,
          reconnectAttempt: 0,
          error: null 
        }));
        
        // Always register session for streaming (use default 'anonymous' if no userId)
        try {
          ws.send(JSON.stringify({
            type: 'register-session',
            userId,
            sessionId,
          }));
        } catch (error) {
          console.error('Failed to register session:', error);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: StreamMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'session-registered':
              console.log('📡 WebSocket session registered:', message.sessionId);
              break;

            case 'ai-status':
              setStreamState(prev => ({
                ...prev,
                currentStatus: message.message || '',
              }));
              break;

            case 'ai-chunk':
              setStreamState(prev => ({
                ...prev,
                fullMessage: prev.fullMessage + (message.content || ''),
              }));
              break;

            case 'ai-thought':
              setStreamState(prev => ({
                ...prev,
                currentThought: message.thought || '',
              }));
              break;

            case 'ai-action':
              setStreamState(prev => ({
                ...prev,
                currentAction: message.action || '',
                currentStep: message.step || 0,
                totalSteps: message.totalSteps || 12,
              }));
              break;

            case 'ai-complete':
              setStreamState(prev => ({
                ...prev,
                usage: message.usage || null,
                currentStatus: 'completed',
              }));
              break;

            case 'ai-error':
              setStreamState(prev => ({
                ...prev,
                error: message.error || 'Unknown error',
                currentStatus: 'failed',
              }));
              break;

            case 'file_status':
              setStreamState(prev => ({
                ...prev,
                currentFile: {
                  action: message.action || 'processing',
                  filename: message.filename || '',
                  language: message.language || 'plaintext',
                },
              }));
              break;

            case 'file_summary':
              setStreamState(prev => ({
                ...prev,
                fileSummary: {
                  filesChanged: message.filesChanged || 0,
                  linesAdded: message.linesAdded || 0,
                  linesRemoved: message.linesRemoved,
                },
                currentFile: null, // Clear current file when summary arrives
              }));
              break;
          }
        } catch (error) {
          console.error('❌ WebSocket message parse error:', error);
          // Don't throw - gracefully handle malformed messages
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setStreamState(prev => ({
          ...prev,
          error: 'Connection error',
        }));
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        
        setStreamState(prev => ({ ...prev, isConnected: false }));
        wsRef.current = null;

        // Attempt reconnection if it was an unexpected disconnect and we should reconnect
        if (shouldReconnectRef.current && !event.wasClean) {
          reconnectAttemptsRef.current += 1;
          const backoffDelay = calculateBackoff(reconnectAttemptsRef.current - 1);
          
          console.log(`🔄 Reconnecting in ${Math.round(backoffDelay / 1000)}s (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          setStreamState(prev => ({
            ...prev,
            isReconnecting: true,
            reconnectAttempt: reconnectAttemptsRef.current,
          }));

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, backoffDelay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      setStreamState(prev => ({
        ...prev,
        error: 'Failed to establish connection',
        isConnected: false,
      }));
    }
  }, [sessionId, userId, calculateBackoff]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false; // Disable auto-reconnect
    
    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close WebSocket if open
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect'); // 1000 = normal closure
      wsRef.current = null;
    }
    
    setStreamState(prev => ({ 
      ...prev, 
      isConnected: false,
      isReconnecting: false 
    }));
  }, []);

  const resetState = useCallback(() => {
    setStreamState(prev => ({
      ...prev,
      currentStatus: '',
      currentThought: '',
      currentAction: '',
      currentStep: 0,
      totalSteps: 12,
      fullMessage: '',
      usage: null,
      error: null,
      currentFile: null,
      fileSummary: null,
    }));
  }, []);

  const forceReconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0; // Reset attempts
    disconnect();
    shouldReconnectRef.current = true;
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, [connect]);

  return {
    ...streamState,
    connect,
    disconnect,
    resetState,
    forceReconnect,
  };
}
