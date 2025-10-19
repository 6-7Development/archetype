import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PlanUpgradeDialogProps {
  currentPlan: string;
  children: React.ReactNode;
}

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    features: [
      "100 AI project generations/month",
      "500K tokens/month",
      "Standard support",
      "Email notifications",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 99,
    features: [
      "500 AI project generations/month",
      "2.5M tokens/month",
      "Priority support",
      "Advanced analytics",
      "Custom templates",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 499,
    features: [
      "Unlimited AI generations",
      "Unlimited tokens",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "Team collaboration",
    ],
  },
];

export function PlanUpgradeDialog({ currentPlan, children }: PlanUpgradeDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const checkoutMutation = useMutation({
    mutationFn: async (plan: string) => {
      const response = await apiRequest("POST", "/api/stripe/create-checkout-session", { plan });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: "Failed to create checkout session",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to start checkout process",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Upgrade Your Plan</DialogTitle>
          <DialogDescription>
            Choose the perfect plan for your needs. You can change or cancel anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const canUpgrade = !isCurrentPlan && 
              ((currentPlan === 'free' && plan.id !== 'free') ||
               (currentPlan === 'starter' && (plan.id === 'pro' || plan.id === 'enterprise')) ||
               (currentPlan === 'pro' && plan.id === 'enterprise'));

            return (
              <Card 
                key={plan.id} 
                className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
                data-testid={`card-plan-${plan.id}`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" data-testid="badge-popular">
                    Most Popular
                  </Badge>
                )}
                
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{plan.name}</span>
                    {isCurrentPlan && (
                      <Badge variant="secondary" data-testid={`badge-current-${plan.id}`}>Current</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    disabled={!canUpgrade || checkoutMutation.isPending}
                    onClick={() => checkoutMutation.mutate(plan.id)}
                    data-testid={`button-upgrade-${plan.id}`}
                  >
                    {checkoutMutation.isPending && checkoutMutation.variables === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : canUpgrade ? (
                      'Upgrade Now'
                    ) : (
                      'Not Available'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            💳 Secure payment powered by Stripe. All plans include a 14-day money-back guarantee.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
