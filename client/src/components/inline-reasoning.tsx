import { useState } from 'react';
import { ChevronDown, Lightbulb, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReasoningStep {
  type: 'decision' | 'analysis' | 'parallel' | 'result' | 'warning';
  title: string;
  content?: string;
  items?: string[];
  icon?: 'lightbulb' | 'zap' | 'check' | 'alert';
  isExpanded?: boolean;
}

interface InlineReasoningProps {
  steps: ReasoningStep[];
  isStreaming?: boolean;
}

const ICONS = {
  lightbulb: Lightbulb,
  zap: Zap,
  check: CheckCircle2,
  alert: AlertCircle,
};

const COLORS = {
  decision: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400',
  analysis: 'bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400',
  parallel: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
  result: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400',
};

export function InlineReasoning({ steps, isStreaming = false }: InlineReasoningProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!steps.length) return null;

  return (
    <div className="space-y-2 my-3">
      {steps.map((step, idx) => {
        const Icon = ICONS[step.icon || 'lightbulb'];
        const color = COLORS[step.type];
        const isExpanded = expandedIdx === idx;

        return (
          <div
            key={idx}
            className={cn(
              'border rounded-lg px-3 py-2 transition-all',
              color,
              isExpanded && 'ring-1 ring-offset-1'
            )}
          >
            <button
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              className="w-full flex items-start gap-2 text-left"
            >
              <div className="flex-shrink-0 mt-0.5">
                {Icon && <Icon className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{step.title}</div>
                {!isExpanded && step.items && step.items.length > 0 && (
                  <div className="text-xs opacity-75 mt-1">
                    {step.items.length} item{step.items.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              {(step.items?.length || step.content) && (
                <ChevronDown
                  className={cn(
                    'h-4 w-4 flex-shrink-0 transition-transform mt-0.5',
                    isExpanded && 'rotate-180'
                  )}
                />
              )}
            </button>

            {isExpanded && (
              <div className="mt-2 ml-6 space-y-1.5 text-sm opacity-90">
                {step.content && <p>{step.content}</p>}
                {step.items && (
                  <ul className="space-y-1">
                    {step.items.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-xs font-bold">{i + 1}.</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
      {isStreaming && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <div className="h-1.5 w-1.5 rounded-full bg-current" />
          Processing...
        </div>
      )}
    </div>
  );
}
