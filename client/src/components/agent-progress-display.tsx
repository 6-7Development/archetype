import { Loader2, Sparkles, Brain, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentProgressDisplayProps {
  status: 'thinking' | 'working' | 'vibing' | 'idle';
  message?: string;
}

export function AgentProgressDisplay({ status, message }: AgentProgressDisplayProps) {
  const statusConfig = {
    thinking: {
      icon: Brain,
      text: 'Thinking...',
      // Citrus-themed: Sparkling Lemon with pulse animation
      className: 'text-[hsl(50,98%,58%)] animate-pulse',
      iconClassName: 'animate-pulse',
      containerClassName: 'bg-[hsl(50,98%,58%)]/10 border border-[hsl(50,98%,58%)]/20 rounded-md px-3 py-1.5',
    },
    working: {
      icon: Zap,
      text: 'Working...',
      // Citrus-themed: Fresh Mint with gentle spin
      className: 'text-[hsl(145,60%,45%)]',
      iconClassName: 'animate-spin',
      containerClassName: 'bg-[hsl(145,60%,45%)]/10 border border-[hsl(145,60%,45%)]/20 rounded-md px-3 py-1.5',
    },
    vibing: {
      icon: Sparkles,
      text: 'Vibing..',
      // Citrus-themed: Citrus Bloom with sparkle
      className: 'text-[hsl(32,94%,62%)] animate-pulse',
      iconClassName: 'animate-pulse',
      containerClassName: 'bg-[hsl(32,94%,62%)]/10 border border-[hsl(32,94%,62%)]/20 rounded-md px-3 py-1.5',
    },
    idle: {
      icon: Sparkles,
      text: '',
      className: 'text-muted-foreground',
      iconClassName: '',
      containerClassName: '',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  if (status === 'idle') {
    return null;
  }

  return (
    <div 
      className={cn('flex items-center gap-2 text-sm font-medium transition-all duration-300', config.containerClassName)}
      data-testid="agent-progress-display"
    >
      <Icon className={cn('w-4 h-4 shrink-0', config.iconClassName, config.className)} />
      <span className={cn('truncate', config.className)}>{message || config.text}</span>
    </div>
  );
}
