import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "@/components/mobile-nav";
import { MotionToggle } from "@/components/motion-toggle";
import { Check, Sparkles, Zap, Shield, TrendingUp, DollarSign, Info } from "lucide-react";
import { LogoEnhancedBadge, LomuTextLogo } from '@/components/final-logos';
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

// Get Stripe price IDs from environment (set by user in Secrets)
const STRIPE_PRICE_IDS = {
  starter: import.meta.env.VITE_STRIPE_PRICE_ID_STARTER,
  pro: import.meta.env.VITE_STRIPE_PRICE_ID_PRO,
  business: import.meta.env.VITE_STRIPE_PRICE_ID_BUSINESS,
  enterprise: import.meta.env.VITE_STRIPE_PRICE_ID_ENTERPRISE,
};

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/forever",
    description: "Perfect for trying out Lomu",
    tokenAllowance: "30,000 tokens",
    projectEstimate: "~3-6 simple projects",
    features: [
      "30,000 tokens (lifetime)",
      "~3-6 simple projects",
      "Automatic complexity detection",
      "Real-time cost preview",
      "AI-generated code (requires review)",
      "Download projects (ZIP)",
      "Community support"
    ],
    cta: "Get Started Free",
    popular: false,
    priceId: null,
    planKey: null
  },
  {
    name: "Starter",
    price: "$49",
    period: "/month",
    description: "For individual developers",
    tokenAllowance: "120,000 tokens/month",
    projectEstimate: "~12-24 simple, 4-8 medium",
    features: [
      "120,000 tokens per month",
      "~12-24 simple or 4-8 medium projects",
      "No hidden fees (pay what you see)",
      "Overage: $1.50 per 1K tokens",
      "TypeScript + automated tests",
      "Template gallery access",
      "1-click deployment",
      "Custom subdomains",
      "Email support (48hr)"
    ],
    cta: "Start Building",
    popular: true,
    priceId: STRIPE_PRICE_IDS.starter,
    planKey: "starter"
  },
  {
    name: "Pro",
    price: "$129",
    period: "/month",
    description: "Most popular for professionals",
    tokenAllowance: "300,000 tokens/month",
    projectEstimate: "~30-60 simple, 10-20 medium",
    features: [
      "300,000 tokens per month",
      "~30-60 simple or 10-20 medium projects",
      "Transparent pricing (no surprises)",
      "Overage: $1.50 per 1K tokens",
      "All Starter features",
      "API key management",
      "Template marketplace",
      "Advanced analytics",
      "Version history",
      "Priority support (24hr)"
    ],
    cta: "Upgrade to Pro",
    popular: false,
    priceId: STRIPE_PRICE_IDS.pro,
    planKey: "pro"
  },
  {
    name: "Business",
    price: "$299",
    period: "/month",
    description: "For teams and agencies",
    tokenAllowance: "800,000 tokens/month",
    projectEstimate: "~80-160 simple, 25-50 medium",
    features: [
      "800,000 tokens per month",
      "~80-160 simple or 25-50 medium projects",
      "Predictable billing (no hidden costs)",
      "Overage: $1.50 per 1K tokens",
      "All Pro features",
      "Team workspaces (5 seats)",
      "White-label program (+$99/mo)",
      "Live collaboration",
      "Priority queue",
      "Dedicated support (12hr)"
    ],
    cta: "Start Business",
    popular: false,
    priceId: STRIPE_PRICE_IDS.business,
    planKey: "business"
  },
  {
    name: "Enterprise",
    price: "$899",
    period: "/month",
    description: "Scale without surprise bills",
    tokenAllowance: "3M tokens/month",
    projectEstimate: "~300-600 simple, 100-200 medium",
    features: [
      "3,000,000 tokens per month",
      "~300-600 simple or 100-200 medium",
      "100% transparent costs",
      "Overage: $1.50 per 1K tokens (best rate)",
      "All Business features",
      "Unlimited team seats",
      "SSO (Okta, Azure AD)",
      "Audit logs & compliance",
      "Multi-region deployment",
      "24/7 support (4hr SLA)"
    ],
    cta: "Contact Sales",
    popular: false,
    priceId: STRIPE_PRICE_IDS.enterprise,
    planKey: "enterprise"
  }
];

export default function Pricing() {
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Stripe checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async ({ priceId, planName }: { priceId: string; planName: string }) => {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, planName }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      setLoadingPlan(null);
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCheckout = async (planName: string, priceId: string | null | undefined, planKey: string | null) => {
    if (planName === "Free") {
      window.location.href = "/builder";
      return;
    }

    if (!priceId) {
      toast({
        title: "Configuration Required",
        description: "Stripe price IDs are not configured. Please add VITE_STRIPE_PRICE_ID_* to your environment secrets.",
        variant: "destructive",
      });
      return;
    }

    setLoadingPlan(planName);
    checkoutMutation.mutate({ priceId, planName: planKey || planName.toLowerCase() });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <MobileNav
                links={[
                  { href: "/", label: "Home" },
                  { href: "/pricing", label: "Pricing" },
                  { href: "/builder", label: "Get Started" }
                ]}
                logo={
                  <LomuTextLogo size="sm" />
                }
              />
              <Link href="/" data-testid="link-home" className="hidden lg:flex">
                <div className="hover-elevate active-elevate-2 transition-all cursor-pointer">
                  <LomuTextLogo size="default" />
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <MotionToggle />
              <Button variant="ghost" className="hidden lg:inline-flex" data-testid="button-nav-pricing" asChild>
                <Link href="/pricing">Pricing</Link>
              </Button>
              <Button variant="default" size="sm" data-testid="button-nav-builder" asChild>
                <Link href="/builder">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Value Proposition Banner */}
      <section className="pt-24 pb-8 px-6">
        <div className="container mx-auto max-w-6xl">
          <Card className="border-2 border-primary/50 bg-gradient-to-br from-primary/30 to-secondary/30 overflow-hidden">
            <div className="p-8">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/20">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    AI Development Done Right: Transparent, Predictable, Fair
                  </h3>
                  <p className="text-slate-300 text-lg mb-4">
                    <strong>Know exactly what you'll pay before you build.</strong> Our token-based pricing model gives you complete transparency and control over your AI development costs.
                  </p>
                  
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        <span className="font-semibold text-white">Real-Time Cost Preview</span>
                      </div>
                      <p className="text-sm text-slate-400">
                        See exact token cost and complexity analysis before building any project
                      </p>
                    </div>
                    
                    <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-5 h-5 text-primary" />
                        <span className="font-semibold text-white">Smart Complexity Detection</span>
                      </div>
                      <p className="text-sm text-slate-400">
                        Automatic analysis of your project's scope and estimated token usage
                      </p>
                    </div>
                    
                    <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-secondary" />
                        <span className="font-semibold text-white">Usage Dashboard</span>
                      </div>
                      <p className="text-sm text-slate-400">
                        Track token consumption, project count, and monthly spend in real-time
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-4 rounded-lg bg-green-900/30 border border-green-500/30">
                    <Check className="w-5 h-5 text-green-400 shrink-0" />
                    <p className="text-sm text-green-100">
                      <strong>Fortune 500-grade transparency:</strong> Every plan includes automatic cost estimation, token tracking, and predictable overage pricing at just $1.50 per 1,000 tokens.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Hero */}
      <section className="pt-12 pb-12 px-6">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Token-Based Pricing • No Hidden Fees</span>
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Transparent AI Pricing
            </span>
            <br />
            <span className="text-white">Built for Professionals</span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            Pay for what you use. See costs before you build. No surprises, no hidden fees, no games.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 px-6 pb-20">
        <div className="container mx-auto max-w-7xl">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {plans.map((plan, i) => (
              <Card 
                key={i} 
                className={`p-8 relative ${
                  plan.popular 
                    ? 'bg-gradient-to-br from-primary/30 to-secondary/30 border-primary/50 shadow-xl shadow-primary/20' 
                    : 'bg-slate-900/50 border-slate-800'
                } hover-elevate transition-all overflow-visible`}
                data-testid={`card-plan-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-secondary rounded-full text-xs font-semibold text-white">
                    MOST POPULAR
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2" data-testid={`text-plan-name-${plan.name.toLowerCase()}`}>{plan.name}</h3>
                  <p className="text-sm text-slate-400 mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent" data-testid={`text-price-${plan.name.toLowerCase()}`}>
                      {plan.price}
                    </span>
                    <span className="text-slate-500">{plan.period}</span>
                  </div>
                  
                  {/* Token Allowance Badge */}
                  <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Token Allowance</div>
                    <div className="text-sm font-mono text-primary">{plan.tokenAllowance}</div>
                    <div className="text-xs text-slate-500 mt-1">{plan.projectEstimate}</div>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm" data-testid={`feature-${plan.name.toLowerCase()}-${j}`}>
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.name === "Enterprise" ? (
                  <Button 
                    variant="secondary"
                    className="w-full"
                    data-testid={`button-plan-${plan.name.toLowerCase()}`}
                    asChild
                  >
                    <a href="mailto:sales@archetypeai.dev?subject=Enterprise%20Plan%20Inquiry">
                      {plan.cta}
                    </a>
                  </Button>
                ) : (
                  <Button 
                    variant={plan.popular ? "default" : "secondary"}
                    className={plan.popular ? "w-full bg-gradient-to-r from-secondary to-accent hover:opacity-90 border-0" : "w-full"}
                    data-testid={`button-plan-${plan.name.toLowerCase()}`}
                    onClick={() => handleCheckout(plan.name, plan.priceId, plan.planKey)}
                    disabled={loadingPlan === plan.name}
                  >
                    {loadingPlan === plan.name ? "Loading..." : plan.cta}
                  </Button>
                )}
              </Card>
            ))}
          </div>

          {/* Overage Pricing Explainer */}
          <div className="mt-12 text-center">
            <Card className="inline-block p-6 bg-slate-900/50 border-slate-800">
              <h4 className="text-lg font-semibold text-white mb-2">Transparent Overage Pricing</h4>
              <p className="text-slate-400 mb-4">
                Need more tokens? No problem. No surprise bills.
              </p>
              <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30">
                <Zap className="w-5 h-5 text-primary" />
                <span className="text-primary font-mono font-bold">$1.50 per 1,000 tokens</span>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                You'll see the exact cost BEFORE building any project that exceeds your plan.
              </p>
            </Card>
          </div>

          {/* AI Disclaimer */}
          <div className="mt-8 text-center" data-testid="section-ai-disclaimer">
            <div className="inline-flex items-start gap-2 px-4 py-3 rounded-lg bg-slate-800/30 border border-slate-700/50 max-w-3xl">
              <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-400 text-left">
                Note: All plans include AI-assisted code generation that requires human review and testing. Actual development time varies based on project complexity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="py-20 px-6 bg-slate-950/50">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              What Makes Lomu Different
            </span>
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-8 bg-slate-900/50 border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20">
                  <DollarSign className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white">Cost Preview</h3>
              </div>
              <p className="text-slate-400 mb-4">
                See exactly how many tokens and dollars your project will cost before building. No surprises.
              </p>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Automatic complexity detection</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Token usage estimation</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Confirm before proceeding</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 bg-slate-900/50 border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20">
                  <TrendingUp className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="text-xl font-bold text-white">Usage Dashboard</h3>
              </div>
              <p className="text-slate-400 mb-4">
                Track your token consumption, project count, and monthly spend in real-time.
              </p>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Live token usage tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Monthly cost breakdown</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Remaining project estimates</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 bg-slate-900/50 border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20">
                  <Shield className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Fair Pricing</h3>
              </div>
              <p className="text-slate-400 mb-4">
                Token-based pricing that scales with your actual usage. Pay for what you use, nothing more.
              </p>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <span>$1.50 per 1,000 tokens overage</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <span>No hidden fees or charges</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <span>Predictable monthly billing</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Comparison */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Every Plan Includes
            </span>
          </h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              "Claude Sonnet 4 AI",
              "Real-time cost preview",
              "Automatic complexity detection",
              "Token usage dashboard",
              "No hidden fees",
              "Monaco code editor",
              "Multi-language support",
              "12-step quality workflow",
              "Secure authentication"
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3" data-testid={`common-feature-${i}`}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-primary" />
                </div>
                <span className="text-slate-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10">
        <div className="container mx-auto max-w-6xl text-center text-slate-500">
          <div className="flex items-center justify-center gap-3 mb-4">
            <LomuTextLogo size="sm" />
          </div>
          <p className="text-sm">© 2025 Lomu. Transparent AI-Powered Development.</p>
          <p className="text-xs mt-2">No hidden fees. No surprise bills. Pay for what you use.</p>
        </div>
      </footer>
    </div>
  );
}
