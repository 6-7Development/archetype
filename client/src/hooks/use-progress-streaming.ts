/**
 * USE PROGRESS STREAMING HOOK
 * React hook for consuming SSE progress events
 * Provides real-time updates to UI components
 */

import { useState, useEffect, useCallback } from "react";

interface ProgressEvent {
  type: "thinking" | "action" | "result" | "phase" | "error" | "complete";
  message: string;
  timestamp: number;
  phase?: string;
  toolName?: string;
  percent?: number;
  duration?: number;
}

interface UseProgressStreamingOptions {
  conversationId: string;
  onEvent?: (event: ProgressEvent) => void;
  onPhaseChange?: (phase: string, percent: number) => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
}

export function useProgressStreaming({
  conversationId,
  onEvent,
  onPhaseChange,
  onError,
  autoConnect = true,
}: UseProgressStreamingOptions) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>("ASSESS");
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!conversationId) return;

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`/api/chat/progress/${conversationId}`);

      eventSource.onopen = () => {
        console.log(`[USE-PROGRESS-STREAMING] Connected to ${conversationId}`);
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ProgressEvent;

          if (data.type === "connected") {
            return;
          }

          setEvents((prev) => [...prev, data]);
          onEvent?.(data);

          // Track phase changes
          if (data.type === "phase") {
            setCurrentPhase(data.phase || "WORKING");
            setProgress(data.percent || 0);
            onPhaseChange?.(data.phase || "WORKING", data.percent || 0);
          }
        } catch (err) {
          console.error("[USE-PROGRESS-STREAMING] Parse error:", err);
        }
      };

      eventSource.onerror = () => {
        console.warn("[USE-PROGRESS-STREAMING] Connection error");
        setIsConnected(false);
        const errorMsg = "Progress stream connection lost";
        setError(errorMsg);
        onError?.(errorMsg);
      };

      return () => {
        eventSource?.close();
      };
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error("[USE-PROGRESS-STREAMING] Error:", errorMsg);
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [conversationId, onEvent, onPhaseChange, onError]);

  useEffect(() => {
    if (!autoConnect) return;
    const cleanup = connect();
    return cleanup;
  }, [autoConnect, connect]);

  return {
    events,
    currentPhase,
    progress,
    isConnected,
    error,
    connect,
  };
}
