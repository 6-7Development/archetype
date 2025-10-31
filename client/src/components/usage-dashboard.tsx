import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, DollarSign, Calendar } from "lucide-react";

interface UsageStats {
  plan: string;
  tokensUsed: number;
  tokenLimit: number;
  projectsThisMonth: number;
  totalCost: string;
  totalAICost: string;
}

export default function UsageDashboard() {
  const { data: usage, isLoading } = useQuery<UsageStats>({
    queryKey: ["/api/usage/stats"],
  });

  if (isLoading || !usage) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const usagePercentage = usage.tokenLimit > 0 
    ? (usage.tokensUsed / usage.tokenLimit) * 100 
    : 0;

  const tokensRemaining = Math.max(0, usage.tokenLimit - usage.tokensUsed);

  // Estimate remaining projects (based on medium project avg: 20K tokens)
  const estimatedProjectsRemaining = Math.floor(tokensRemaining / 20000);

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Token Usage */}
        <Card data-testid="card-token-usage">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Token Usage</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-tokens-used">
              {usage.tokensUsed.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of {usage.tokenLimit.toLocaleString()} tokens
            </p>
            <Progress 
              value={Math.min(usagePercentage, 100)} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {usagePercentage.toFixed(1)}% used
            </p>
          </CardContent>
        </Card>

        {/* Projects This Month */}
        <Card data-testid="card-projects">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Projects Built</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-projects-count">
              {usage.projectsThisMonth}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              this month
            </p>
            <p className="text-xs text-primary mt-2">
              ~{estimatedProjectsRemaining} medium projects remaining
            </p>
          </CardContent>
        </Card>

        {/* Cost This Month */}
        <Card data-testid="card-cost">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">AI Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-ai-cost">
              ${usage.totalAICost}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              token costs this month
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              ✓ Included in your plan
            </p>
          </CardContent>
        </Card>

        {/* Current Plan */}
        <Card data-testid="card-plan">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge 
                variant={usage.plan === 'enterprise' ? 'default' : 'secondary'}
                className="text-base capitalize"
                data-testid="badge-plan"
              >
                {usage.plan}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {usage.tokenLimit.toLocaleString()} tokens/month
            </p>
            <p className="text-xs text-primary mt-1">
              Overage: $1.50 per 1K tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Details</CardTitle>
          <CardDescription>
            Your token consumption and remaining allowance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Token Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tokens Used</span>
              <span className="font-mono">{usage.tokensUsed.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tokens Remaining</span>
              <span className="font-mono font-medium text-primary">
                {tokensRemaining.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Monthly Allowance</span>
              <span className="font-mono">{usage.tokenLimit.toLocaleString()}</span>
            </div>
          </div>

          {/* Warning Messages */}
          {usagePercentage >= 80 && usagePercentage < 95 && (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950 p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ You've used {usagePercentage.toFixed(0)}% of your monthly tokens. 
                Additional usage will incur overage charges of $1.50 per 1,000 tokens.
              </p>
            </div>
          )}

          {usagePercentage >= 95 && (
            <div className="rounded-lg bg-orange-50 dark:bg-orange-950 p-3">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                ⚠️ You're at {usagePercentage.toFixed(0)}% of your monthly limit. 
                Consider upgrading your plan to avoid overage charges.
              </p>
            </div>
          )}

          {/* Transparency Message */}
          <div className="rounded-lg bg-green-50 dark:bg-green-950 p-3">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✓ <strong>No hidden fees.</strong> You'll always see the cost before building. 
              Unlike Replit's surprise $2,000 Agent bills, Lomu shows transparent pricing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
