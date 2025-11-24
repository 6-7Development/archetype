import { AlertCircle, CheckCircle, Zap, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export interface CostPreviewProps {
  complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
  estimatedTokens: number;
  tokensRemaining: number;
  tokenLimit: number;
  overageTokens: number;
  overageCost: number;
  reasons: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const COMPLEXITY_CONFIG = {
  simple: {
    label: 'Simple Project',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: CheckCircle,
    description: 'Landing pages, portfolios, basic sites',
  },
  medium: {
    label: 'Medium Project',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: Zap,
    description: 'Web apps, dashboards, interactive sites',
  },
  complex: {
    label: 'Complex Project',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    icon: TrendingUp,
    description: 'SaaS platforms, marketplaces, advanced apps',
  },
  enterprise: {
    label: 'Enterprise Project',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    icon: AlertCircle,
    description: 'Games, large platforms, enterprise systems',
  },
};

export default function CostPreview({
  complexity,
  estimatedTokens,
  tokensRemaining,
  tokenLimit,
  overageTokens,
  overageCost,
  reasons,
  onConfirm,
  onCancel,
  isLoading = false,
}: CostPreviewProps) {
  const config = COMPLEXITY_CONFIG[complexity];
  const Icon = config.icon;
  const hasOverage = overageTokens > 0;
  const usagePercentage = ((tokenLimit - tokensRemaining) / tokenLimit) * 100;

  // Calculate remaining projects of similar complexity
  const remainingProjects = Math.floor(tokensRemaining / estimatedTokens);

  return (
    <Card className="border-2" data-testid="cost-preview-card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.color}`} />
              Project Cost Estimate
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Review your project details before building
            </p>
          </div>
          <Badge className={config.bgColor} variant="secondary" data-testid="complexity-badge">
            <span className={config.color}>{config.label}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Complexity Info */}
        <div className={`rounded-lg p-4 ${config.bgColor}`}>
          <div className="flex items-start gap-3">
            <Icon className={`h-6 w-6 ${config.color} mt-0.5`} />
            <div className="flex-1">
              <h4 className={`font-medium ${config.color}`}>{config.label}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {config.description}
              </p>
            </div>
          </div>

          {reasons.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {reasons.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />

        {/* Token Usage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Estimated Tokens</span>
            <span className="text-sm font-mono" data-testid="estimated-tokens">
              ~{estimatedTokens.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tokens Remaining</span>
            <span className={`text-sm font-mono ${tokensRemaining < estimatedTokens ? 'text-orange-600 : ''}`} data-testid="tokens-remaining">
              {tokensRemaining.toLocaleString()} / {tokenLimit.toLocaleString()}
            </span>
          </div>

          {/* Usage Bar */}
          <div className="space-y-1">
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  usagePercentage >= 90
                    ? 'bg-orange-500'
                    : usagePercentage >= 70
                    ? 'bg-yellow-500'
                    : 'bg-primary'
                }`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {usagePercentage.toFixed(0)}% used this month
            </p>
          </div>

          {!hasOverage && remainingProjects > 0 && (
            <p className="text-xs text-muted-foreground">
              After this project: ~{remainingProjects} similar projects remaining
            </p>
          )}
        </div>

        {/* Overage Warning */}
        {hasOverage && (
          <>
            <Separator />
            <div className="rounded-lg border-2 border-orange-200 bg-orange-50 dark:bg-orange-950 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-orange-900
                    Overage Tokens Required
                  </h4>
                  <p className="text-sm text-orange-700 mt-1">
                    This project needs more tokens than your current plan allows
                  </p>
                  
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Overage needed:</span>
                      <span className="font-mono font-medium" data-testid="overage-tokens">
                        {overageTokens.toLocaleString()} tokens
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Overage cost:</span>
                      <span className="font-mono font-medium text-lg" data-testid="overage-cost">
                        ${overageCost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Success Message */}
        {!hasOverage && (
          <>
            <Separator />
            <div className="rounded-lg bg-green-50 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 />
                <div>
                  <h4 className="font-medium text-green-900 data-testid="cost-included">
                    ✓ Cost Included in Your Plan
                  </h4>
                  <p className="text-sm text-green-700 mt-1">
                    No additional charges for this project
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            disabled={isLoading}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1"
            disabled={isLoading}
            data-testid="button-confirm"
          >
            {isLoading ? (
              <>Building...</>
            ) : hasOverage ? (
              <>Pay ${overageCost.toFixed(2)} & Build</>
            ) : (
              <>Build Project</>
            )}
          </Button>
        </div>

        {hasOverage && (
          <p className="text-xs text-center text-muted-foreground">
            Overage charges: $1.50 per 1,000 tokens • No hidden fees
          </p>
        )}
      </CardContent>
    </Card>
  );
}
