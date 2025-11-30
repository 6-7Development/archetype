import { Badge } from '@/components/ui/badge';
import { Coins } from 'lucide-react';

interface ConsultationCostProps {
  inputTokens: number;
  outputTokens: number;
  model?: 'gemini-2.5-flash' | 'gpt-4-turbo';
  costPerMT?: number; // Override cost calculation
}

const MODEL_PRICING = {
  'gemini-2.5-flash': { input: 0.075, output: 0.3 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
};

export function ConsultationCostBadge({
  inputTokens,
  outputTokens,
  model = 'gemini-2.5-flash',
  costPerMT,
}: ConsultationCostProps) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gemini-2.5-flash'];
  
  const cost = costPerMT 
    ? ((inputTokens + outputTokens) * costPerMT) / 1000000
    : (inputTokens * pricing.input + outputTokens * pricing.output) / 1000000;

  const totalTokens = inputTokens + outputTokens;

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="gap-1.5 text-xs">
        <Coins className="h-3 w-3" />
        <span className="font-mono">${cost.toFixed(4)}</span>
      </Badge>
      <span className="text-xs text-muted-foreground">
        {totalTokens.toLocaleString()} tokens
      </span>
    </div>
  );
}
