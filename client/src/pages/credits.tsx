import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Coins, 
  CreditCard, 
  Zap, 
  TrendingUp, 
  Sparkles, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Crown
} from 'lucide-react';
import { buildApiUrl } from '@/lib/api-utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface CreditBalance {
  available: number;
  reserved: number;
  total: number;
  initialMonthlyCredits: number;
}

interface CreditPackage {
  id: string;
  credits: number;
  usd: number;
  name: string;
}

export default function Credits() {
  const { toast } = useToast();
  const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null);

  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = useQuery<{ balance: CreditBalance; usdValue: number }>({
    queryKey: ['/api/credits/balance'],
    queryFn: async () => {
      const res = await fetch(buildApiUrl('/api/credits/balance'), {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch balance');
      return res.json();
    },
  });

  const { data: packagesData, isLoading: packagesLoading } = useQuery<{ packages: CreditPackage[]; constants: any }>({
    queryKey: ['/api/credits/packages'],
    queryFn: async () => {
      const res = await fetch(buildApiUrl('/api/credits/packages'), {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch packages');
      return res.json();
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageId: string) => {
      return apiRequest('POST', '/api/credits/purchase', { packageId });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Credits Purchased!',
        description: `${data.creditsAdded?.toLocaleString()} credits added to your account.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/credits/balance'] });
      setPurchasingPackage(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Purchase Failed',
        description: error.message || 'Failed to complete purchase',
        variant: 'destructive',
      });
      setPurchasingPackage(null);
    },
  });

  const handlePurchase = (packageId: string) => {
    setPurchasingPackage(packageId);
    purchaseMutation.mutate(packageId);
  };

  const balance = balanceData?.balance;
  const usagePercent = balance 
    ? Math.round((1 - (balance.available / balance.initialMonthlyCredits)) * 100)
    : 0;

  const getUsageColor = () => {
    if (usagePercent < 50) return 'bg-green-500';
    if (usagePercent < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" data-testid="page-credits">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Coins className="h-8 w-8 text-honey" />
              Credits & Billing
            </h1>
            <p className="text-muted-foreground mt-2">Manage your Scout credits and purchase more when needed</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetchBalance()}
            data-testid="button-refresh-balance"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-honey" />
                Credit Balance
              </CardTitle>
              <CardDescription>Your current Scout credits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {balanceLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : balance ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold">{balance.available.toLocaleString()}</span>
                    <span className="text-muted-foreground">credits available</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Monthly Usage</span>
                      <span>{usagePercent}%</span>
                    </div>
                    <Progress value={usagePercent} className={getUsageColor()} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Used: {(balance.initialMonthlyCredits - balance.available).toLocaleString()}</span>
                      <span>Monthly Allowance: {balance.initialMonthlyCredits.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <div className="text-sm text-muted-foreground">Available</div>
                      <div className="text-xl font-semibold text-green-500">{balance.available.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Reserved</div>
                      <div className="text-xl font-semibold text-yellow-500">{balance.reserved.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Total</div>
                      <div className="text-xl font-semibold">{balance.total.toLocaleString()}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Unable to load balance</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-honey" />
                  <span className="text-sm">Est. Value</span>
                </div>
                <span className="font-semibold">${balanceData?.usdValue?.toFixed(2) || '0.00'}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-honey" />
                  <span className="text-sm">Plan</span>
                </div>
                <Badge variant="outline">Free Tier</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Purchase Credits
          </h2>
          <p className="text-muted-foreground mb-6">Top up your credits to keep Scout working for you</p>
          
          {packagesLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {packagesData?.packages?.map((pkg) => (
                <Card 
                  key={pkg.id} 
                  className={`relative transition-all ${pkg.id === 'large' ? 'border-honey shadow-lg' : 'hover-elevate'}`}
                >
                  {pkg.id === 'large' && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-honey text-black">
                      Best Value
                    </Badge>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-lg">{pkg.name}</CardTitle>
                    <div className="text-3xl font-bold">${pkg.usd.toFixed(2)}</div>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="text-2xl font-semibold text-honey">
                      {pkg.credits.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">credits</div>
                    <div className="text-xs text-muted-foreground mt-2">
                      ${(pkg.usd / pkg.credits * 1000).toFixed(3)} per 1K credits
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      variant={pkg.id === 'large' ? 'default' : 'outline'}
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={purchasingPackage !== null}
                      data-testid={`button-purchase-${pkg.id}`}
                    >
                      {purchasingPackage === pkg.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Buy Now
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How Credits Work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-honey/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-4 w-4 text-honey" />
                </div>
                <div>
                  <h4 className="font-medium">Scout Usage</h4>
                  <p className="text-sm text-muted-foreground">Credits are consumed when Scout performs autonomous work on your projects.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <h4 className="font-medium">Monthly Refresh</h4>
                  <p className="text-sm text-muted-foreground">Free tier users receive a monthly credit allowance that refreshes automatically.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <h4 className="font-medium">Top Up Anytime</h4>
                  <p className="text-sm text-muted-foreground">Purchase additional credits when you need more capacity for larger projects.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
