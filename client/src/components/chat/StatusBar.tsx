import { StatusStrip } from "@/components/agent/StatusStrip";
import type { RunState, RunPhase } from "@shared/agentEvents";

interface StatusBarProps {
  progressStatus: 'thinking' | 'working' | 'vibing' | 'idle';
  progressMessage: string;
  currentPhase: RunPhase;
  phaseMessage: string;
  runState: RunState | null;
  isGenerating: boolean;
}

export function StatusBar({
  progressStatus,
  progressMessage,
  currentPhase,
  phaseMessage,
  runState,
  isGenerating,
}: StatusBarProps) {
  if (!isGenerating && progressStatus === 'idle') {
    return null;
  }

  return (
    <StatusStrip
      phase={currentPhase}
      message={progressMessage || phaseMessage}
      currentThought={progressMessage && progressStatus === 'thinking' ? progressMessage : undefined}
      isExecuting={isGenerating}
    />
  );
}
