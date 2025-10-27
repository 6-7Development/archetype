import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentProgressDisplayProps {
  status: 'thinking' | 'working' | 'vibing' | 'idle';
  message?: string;
}

export function AgentProgressDisplay({ status, message }: AgentProgressDisplayProps) {
  const statusConfig = {
    thinking: {
      icon: Loader2,
      text: 'Thinking...',
      className: 'text-blue-500',
      iconClassName: 'animate-spin',
    },
    working: {
      icon: Loader2,
      text: 'Working...',
      className: 'text-emerald-500',
      iconClassName: 'animate-spin',
    },
    vibing: {
      icon: Sparkles,
      text: 'Vibing..',
      className: 'text-purple-500',
      iconClassName: 'animate-pulse',
    },
    idle: {
      icon: Sparkles,
      text: '',
      className: 'text-muted-foreground',
      iconClassName: '',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  if (status === 'idle') {
    return null;
  }

  return (
    <div 
      className={cn('flex items-center gap-2 text-sm', config.className)}
      data-testid="agent-progress-display"
    >
      <Icon className={cn('w-4 h-4', config.iconClassName)} />
      <span>{message || config.text}</span>
    </div>
  );
}
