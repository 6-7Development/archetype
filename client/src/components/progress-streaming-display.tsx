/**
 * PROGRESS STREAMING DISPLAY - TIER 2 UI COMPONENT
 * Shows real-time progress events from AI workflow
 * Displays thinking, actions, results, and phase progression
 */

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Brain, Wrench, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressEvent {
  type: "thinking" | "action" | "result" | "phase" | "error" | "complete";
  message: string;
  timestamp: number;
  phase?: string;
  toolName?: string;
  percent?: number;
  duration?: number;
}

interface ProgressStreamingDisplayProps {
  conversationId?: string;
  isVisible?: boolean;
  compactMode?: boolean;
}

export function ProgressStreamingDisplay({
  conversationId,
  isVisible = true,
  compactMode = false,
}: ProgressStreamingDisplayProps) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>("ASSESS");
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible || !conversationId) return;

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`/api/chat/progress/${conversationId}`);

      eventSource.onopen = () => {
        console.log("[PROGRESS-DISPLAY] SSE connected");
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "connected") {
            console.log("[PROGRESS-DISPLAY] Connected to progress stream");
            return;
          }

          setEvents((prev) => [...prev, data]);

          // Update phase and progress
          if (data.type === "phase") {
            setCurrentPhase(data.phase || "WORKING");
            setProgress(data.percent || 0);
          }

          // Log to console for debugging
          console.log(`📊 [PROGRESS-EVENT] ${data.type}: ${data.message}`);
        } catch (err) {
          console.error("[PROGRESS-DISPLAY] Error parsing event:", err);
        }
      };

      eventSource.onerror = () => {
        console.warn("[PROGRESS-DISPLAY] SSE error");
        setIsConnected(false);
        setError("Connection lost");
      };

      return () => {
        eventSource?.close();
      };
    } catch (err) {
      console.error("[PROGRESS-DISPLAY] Connection error:", err);
      setError((err as Error).message);
    }
  }, [conversationId, isVisible]);

  if (!isVisible || !conversationId) {
    return null;
  }

  // Compact mode: just show progress bar
  if (compactMode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{currentPhase}</span>
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        {error && <div className="text-xs text-destructive">{error}</div>}
      </div>
    );
  }

  // Full mode: show all events
  const thinkingEvents = events.filter((e) => e.type === "thinking");
  const actionEvents = events.filter((e) => e.type === "action");
  const resultEvents = events.filter((e) => e.type === "result");
  const errorEvents = events.filter((e) => e.type === "error");

  return (
    <Card className="p-4 space-y-4">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Target className="w-4 h-4" />
          Workflow Progress
        </h3>
        <Badge variant={isConnected ? "default" : "outline"}>
          {isConnected ? "Live" : "Disconnected"}
        </Badge>
      </div>

      {/* Phase progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{currentPhase}</span>
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Event summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-blue-500" />
          <span className="text-xs">{thinkingEvents.length} thoughts</span>
        </div>
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-green-500" />
          <span className="text-xs">{actionEvents.length} actions</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-xs">{resultEvents.length} results</span>
        </div>
      </div>

      {/* Recent events */}
      {events.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground">Recent Activity</p>
          {events.slice(-5).map((event, idx) => (
            <div
              key={`${event.timestamp}-${idx}`}
              className="flex items-start gap-2 text-xs p-2 bg-muted rounded"
            >
              {event.type === "thinking" && <Brain className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />}
              {event.type === "action" && <Wrench className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />}
              {event.type === "result" && <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />}
              {event.type === "error" && <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />}
              {event.type === "phase" && <Loader2 className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0 animate-spin" />}

              <div className="flex-1 min-w-0">
                <p className="text-foreground line-clamp-2">{event.message}</p>
                {event.toolName && <p className="text-muted-foreground text-xs mt-1">{event.toolName}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive text-xs rounded">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* No events yet */}
      {events.length === 0 && isConnected && (
        <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Waiting for workflow to start...
        </div>
      )}
    </Card>
  );
}
