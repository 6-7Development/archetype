/**
 * Live Status Strip - Shows current agent phase with emoji indicators
 * Based on Agent Chatroom UX spec
 */

import { RunPhase, PHASE_EMOJIS, PHASE_MESSAGES } from '@shared/agentEvents';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface StatusStripProps {
  phase: RunPhase;
  message?: string;
  isExecuting?: boolean;
}

const PHASE_COLORS: Record<RunPhase, string> = {
  thinking: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  planning: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  working: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  verifying: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  complete: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
};

export function StatusStrip({ phase, message, isExecuting = false }: StatusStripProps) {
  const emoji = PHASE_EMOJIS[phase];
  const defaultMessage = PHASE_MESSAGES[phase];
  const displayMessage = message || defaultMessage;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card/50 border-b border-border" data-testid="agent-status-strip">
      <Badge 
        variant="outline" 
        className={`${PHASE_COLORS[phase]} font-medium`}
        data-testid={`status-badge-${phase}`}
      >
        <span className="mr-1.5">{emoji}</span>
        <span className="capitalize">{phase}</span>
      </Badge>
      
      {isExecuting && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" data-testid="status-spinner" />
      )}
      
      <span className="text-sm text-muted-foreground" data-testid="status-message">
        {displayMessage}
      </span>
    </div>
  );
}
