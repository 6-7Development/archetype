import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { User, CreditCard, BarChart3, Settings, Sparkles, FileText, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlanUpgradeDialog } from "@/components/plan-upgrade-dialog";

interface UsageStats {
  subscription: {
    id: string;
    userId: string;
    plan: string;
    status: string;
    aiCreditsRemaining: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
  plan: string;
  aiCreditsRemaining: number;
  aiCreditsTotal: number;
  tokensUsed: number;
  tokenLimit: number;
  totalAICost: string;
  totalCost: string;
  projectsThisMonth: number;
}

interface Invoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string;
  created: string;
  pdfUrl: string | null;
  hostedUrl: string | null;
}

const PLAN_INFO: Record<string, { name: string; price: number; color: string }> = {
  free: { name: "Free", price: 0, color: "secondary" },
  starter: { name: "Starter", price: 29, color: "default" },
  pro: { name: "Pro", price: 99, color: "default" },
  enterprise: { name: "Enterprise", price: 499, color: "default" },
};

export default function Account() {
  const { data: stats, isLoading, error } = useQuery<UsageStats>({
    queryKey: ["/api/usage/stats"],
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/billing/invoices"],
  });

  const planInfo = PLAN_INFO[stats?.plan || "free"];
  const creditsPercentage = stats?.aiCreditsTotal === -1 
    ? 100 
    : ((stats?.aiCreditsRemaining || 0) / (stats?.aiCreditsTotal || 1)) * 100;
  
  const tokensPercentage = stats?.tokenLimit === -1
    ? 100
    : ((stats?.tokensUsed || 0) / (stats?.tokenLimit || 1)) * 100;

  return (
    <div className="flex-1 overflow-y-auto p-6" data-testid="page-account">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-account-title">Account</h1>
          <p className="text-muted-foreground">
            Manage your account settings and billing information
          </p>
        </div>

        {/* Account Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Plan Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Badge className="text-sm" variant={planInfo?.color as any} data-testid="badge-plan">
                    {planInfo?.name || "Free"}
                  </Badge>
                  <p className="text-2xl font-bold" data-testid="text-plan-price">
                    ${planInfo?.price || 0}/mo
                  </p>
                  <PlanUpgradeDialog currentPlan={stats?.plan || "free"}>
                    <Button size="sm" className="w-full mt-2" data-testid="button-upgrade-plan">
                      Upgrade Plan
                    </Button>
                  </PlanUpgradeDialog>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Credits Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">AI Credits</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-16" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-3xl font-bold" data-testid="text-credits-remaining">
                    {stats?.aiCreditsTotal === -1 ? "∞" : stats?.aiCreditsRemaining || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats?.aiCreditsTotal === -1 
                      ? "Unlimited projects" 
                      : `of ${stats?.aiCreditsTotal} remaining`}
                  </p>
                  {stats?.aiCreditsTotal !== -1 && (
                    <Progress value={creditsPercentage} className="h-2" />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Projects This Month Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-1">
                  <Skeleton className="h-9 w-12" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-3xl font-bold" data-testid="text-projects-count">
                    {stats?.projectsThisMonth || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Generated this month</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Usage Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Token Usage This Month
            </CardTitle>
            <CardDescription>
              Track your AI token consumption and costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tokens Used</span>
                  <span className="font-mono font-medium" data-testid="text-tokens-used">
                    {stats?.tokensUsed?.toLocaleString() || 0}
                    {stats?.tokenLimit !== -1 && (
                      <span className="text-muted-foreground">
                        {" "}/ {stats?.tokenLimit?.toLocaleString()}
                      </span>
                    )}
                  </span>
                </div>
                {stats?.tokenLimit !== -1 && (
                  <Progress value={tokensPercentage} className="h-2" />
                )}
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Total Cost</span>
                  <span className="font-mono font-medium" data-testid="text-total-cost">
                    ${stats?.totalCost || "0.00"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Billing History
            </CardTitle>
            <CardDescription>
              View and download your invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : invoices && invoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} data-testid={`invoice-row-${invoice.id}`}>
                      <TableCell className="font-medium" data-testid={`invoice-number-${invoice.id}`}>
                        {invoice.number || invoice.id.substring(0, 12)}
                      </TableCell>
                      <TableCell data-testid={`invoice-date-${invoice.id}`}>
                        {new Date(invoice.created).toLocaleDateString()}
                      </TableCell>
                      <TableCell data-testid={`invoice-amount-${invoice.id}`}>
                        ${invoice.amount.toFixed(2)} {invoice.currency.toUpperCase()}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                          data-testid={`invoice-status-${invoice.id}`}
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.hostedUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            data-testid={`button-view-invoice-${invoice.id}`}
                          >
                            <a 
                              href={invoice.hostedUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1"
                            >
                              View
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-invoices">
                No invoices yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover-elevate cursor-pointer transition-all" data-testid="card-profile">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>Manage your profile information</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="hover-elevate cursor-pointer transition-all" data-testid="card-billing">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Billing</CardTitle>
                  <CardDescription>Payment method and invoices</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="hover-elevate cursor-pointer transition-all" data-testid="card-analytics">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Usage & Analytics</CardTitle>
                  <CardDescription>View detailed usage statistics</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="hover-elevate cursor-pointer transition-all" data-testid="card-settings">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>Preferences and configurations</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {error && (
          <Card className="bg-destructive/10 border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Account Data</CardTitle>
              <CardDescription>
                Unable to fetch your account information. Please try refreshing the page.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
