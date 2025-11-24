import { useEffect, useState } from 'react';
import { Zap, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

interface TokenMeterProps {
  sessionTokens?: TokenUsage;
  monthlyTokens?: TokenUsage;
  isStreaming?: boolean;
}

export function TokenMeter({ 
  sessionTokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
  monthlyTokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
  isStreaming = false
}: TokenMeterProps) {
  const [display, setDisplay] = useState<'session' | 'monthly'>('session');

  const current = display === 'session' ? sessionTokens : monthlyTokens;
  const costPerM = 0.075; // Gemini 2.5 Flash input cost
  const warningThreshold = 0.80;
  const criticalThreshold = 0.95;
  const monthlyLimit = 1000000; // Default 1M tokens
  
  const percentageUsed = (current.totalTokens / monthlyLimit) * 100;
  const isWarning = percentageUsed >= warningThreshold * 100;
  const isCritical = percentageUsed >= criticalThreshold * 100;

  const formatTokens = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const costColor = isCritical ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-yellow-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400';
  const badgeVariant = isCritical ? 'destructive' : isWarning ? 'secondary' : 'default';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-background/50 hover:bg-background/75 transition-colors cursor-pointer">
          <div className="flex items-center gap-1.5">
            <Zap className={`h-3.5 w-3.5 ${isStreaming ? 'animate-pulse' : ''} ${costColor}`} />
            <span className="text-xs font-mono font-semibold">
              {formatTokens(current.totalTokens)}
            </span>
          </div>
          {display === 'monthly' && (
            <span className="text-xs text-muted-foreground">
              {percentageUsed.toFixed(0)}%
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent align="end" className="w-64">
        <div className="space-y-3">
          <div className="font-semibold text-sm">Token Usage</div>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Input:</span>
              <span className="font-mono">{formatTokens(current.inputTokens)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Output:</span>
              <span className="font-mono">{formatTokens(current.outputTokens)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total:</span>
              <span className={`font-mono ${costColor}`}>{formatTokens(current.totalTokens)}</span>
            </div>
          </div>

          {display === 'monthly' && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Monthly Usage:</span>
                <span className={`font-mono ${costColor}`}>{percentageUsed.toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span>{formatTokens(current.totalTokens)} / {formatTokens(monthlyLimit)}</span>
                <span className={costColor}>Est. ${current.estimatedCost.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-1 pt-1">
            <button
              onClick={() => setDisplay('session')}
              className={`text-xs px-2 py-0.5 rounded ${display === 'session' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              Session
            </button>
            <button
              onClick={() => setDisplay('monthly')}
              className={`text-xs px-2 py-0.5 rounded ${display === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              Monthly
            </button>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
