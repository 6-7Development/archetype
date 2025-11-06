import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MobileNav } from "@/components/mobile-nav";
import { Sparkles, Zap, Shield, Code, Rocket, Check, Play, ArrowRight } from "lucide-react";
import { LomuTextLogo } from '@/components/final-logos';
import { DeploymentStatus } from "@/components/deployment-status";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="container mx-auto px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" data-testid="link-home" className="flex items-center gap-2 flex-shrink-0">
              <LomuTextLogo size="sm" />
            </Link>
            
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Mobile hamburger menu - visible on small screens only */}
              <MobileNav
                links={[
                  { href: "/", label: "Home" },
                  { href: "/pricing", label: "Pricing" },
                  { href: "/auth", label: "Login" },
                  { href: "/builder", label: "Get Started" }
                ]}
                logo={
                  <LomuTextLogo size="sm" />
                }
              />
              
              {/* Desktop navigation buttons - visible on md screens and up */}
              <div className="hidden md:flex items-center gap-2">
                <Button variant="outline" className="min-h-[44px] text-white border-slate-600 hover:bg-slate-800" data-testid="button-nav-pricing" asChild>
                  <Link href="/pricing">View Pricing</Link>
                </Button>
                <Button variant="ghost" className="min-h-[44px] text-white hover:bg-slate-800" data-testid="button-nav-login" asChild>
                  <Link href="/auth">Login</Link>
                </Button>
                <Button variant="default" className="min-h-[44px]" data-testid="button-nav-get-started" asChild>
                  <Link href="/builder">Get Started</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative z-20">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Powered by Claude Sonnet 4</span>
          </div>
          
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight break-words">
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent break-words">
              Build Full-Stack Apps
            </span>
            <br />
            <span className="text-white break-words">With AI in Seconds</span>
          </h1>
          
          <p className="text-xl text-slate-400 mb-10 max-w-3xl mx-auto break-words whitespace-normal">
            Claude Sonnet 4 powered. Zero coding required. Production-ready in minutes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" variant="gradient" data-testid="button-hero-start" asChild>
              <Link href="/builder">
                <Rocket className="w-5 h-5 mr-2" />
                Start Building Free
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-white border-slate-600 hover:bg-slate-800" data-testid="button-hero-pricing" asChild>
              <Link href="/pricing">
                View Pricing
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mt-20 max-w-4xl mx-auto px-2">
            {[
              { value: "Sonnet 4", label: "Claude AI", testId: "stat-accuracy" },
              { value: "12-Step", label: "AI Workflow", testId: "stat-languages" },
              { value: "Full Stack", label: "Web Expertise", testId: "stat-availability" },
              { value: "2D/3D", label: "Game Support", testId: "stat-deployment" }
            ].map((stat, i) => (
              <div key={i} className="text-center" data-testid={stat.testId}>
                <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent whitespace-nowrap">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Screenshots Section */}
      <section className="py-20 px-6 relative bg-slate-900/50">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">
            See the Platform in Action
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Screenshot 1: Mobile Workspace */}
            <Card className="p-4 bg-slate-800 border-slate-700" data-testid="screenshot-workspace">
              <div className="aspect-video bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-center">
                <div className="text-center">
                  <Code className="w-12 h-12 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-slate-400">Mobile Workspace</p>
                  <p className="text-xs text-slate-500 mt-1">Responsive IDE on any device</p>
                </div>
              </div>
              <h3 className="mt-4 font-semibold text-white">Mobile-First Development</h3>
              <p className="text-sm text-slate-400 mt-2">Build apps on any device - desktop or mobile with our responsive workspace</p>
            </Card>

            {/* Screenshot 2: AI Building */}
            <Card className="p-4 bg-slate-800 border-slate-700" data-testid="screenshot-ai-chat">
              <div className="aspect-video bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-slate-400">AI Chat Building Project</p>
                  <p className="text-xs text-slate-500 mt-1">Real-time code generation</p>
                </div>
              </div>
              <h3 className="mt-4 font-semibold text-white">Watch AI Code in Real-Time</h3>
              <p className="text-sm text-slate-400 mt-2">See LomuAI generate files, write code, and test automatically</p>
            </Card>

            {/* Screenshot 3: Live Preview */}
            <Card className="p-4 bg-slate-800 border-slate-700" data-testid="screenshot-preview">
              <div className="aspect-video bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-center">
                <div className="text-center">
                  <Play className="w-12 h-12 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-slate-400">Live Preview Panel</p>
                  <p className="text-xs text-slate-500 mt-1">Instant updates as you build</p>
                </div>
              </div>
              <h3 className="mt-4 font-semibold text-white">Instant Visual Feedback</h3>
              <p className="text-sm text-slate-400 mt-2">See changes reflected immediately as AI codes your app</p>
            </Card>

            {/* Screenshot 4: Deployment */}
            <Card className="p-4 bg-slate-800 border-slate-700" data-testid="screenshot-deployment">
              <div className="aspect-video bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-center">
                <div className="text-center">
                  <Rocket className="w-12 h-12 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-slate-400">Deployment Dashboard</p>
                  <p className="text-xs text-slate-500 mt-1">One-click production deploy</p>
                </div>
              </div>
              <h3 className="mt-4 font-semibold text-white">One-Click Deployment</h3>
              <p className="text-sm text-slate-400 mt-2">Deploy to production with custom domains and SSL automatically</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Value Props - Simplified to 3 */}
      <section className="py-20 px-6 relative">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 break-words leading-snug">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent break-words">
                Why Choose Lomu
              </span>
            </h2>
            <p className="text-xl text-slate-400 break-words">Fast, Quality, Transparent</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Speed */}
            <Card className="p-6 bg-slate-900/50 border-slate-800 hover-elevate overflow-visible h-full" data-testid="feature-speed">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary mb-4">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white break-words">Lightning Fast</h3>
              <p className="text-slate-400 break-words whitespace-normal">
                12-step AI workflow delivers production-ready code in minutes. Build complete full-stack apps instantly.
              </p>
            </Card>

            {/* Quality */}
            <Card className="p-6 bg-slate-900/50 border-slate-800 hover-elevate overflow-visible h-full" data-testid="feature-quality">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white break-words">Enterprise Quality</h3>
              <p className="text-slate-400 break-words whitespace-normal">
                Self-testing, validation, and security audits built-in. Claude Sonnet 4 ensures production-grade code.
              </p>
            </Card>

            {/* Transparency */}
            <Card className="p-6 bg-slate-900/50 border-slate-800 hover-elevate overflow-visible h-full" data-testid="feature-transparency">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary mb-4">
                <Code className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white break-words">100% Transparent</h3>
              <p className="text-slate-400 break-words whitespace-normal">
                See exact cost before building. Real-time token tracking. Fair pricing at $1.50 per 1,000 overage tokens.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section className="py-20 px-6 relative bg-slate-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 break-words leading-snug">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent break-words">
                See AI in Action
              </span>
            </h2>
            <p className="text-xl text-slate-400 break-words">Watch Lomu squeeze fresh, production-ready code</p>
          </div>

          <Card className="p-8 bg-gradient-to-br from-slate-900/80 to-slate-950/80 border-primary/20 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-bold text-white break-words">Command: "Build a landing page for a SaaS product"</h3>
            </div>
            <div className="bg-slate-950 rounded-lg p-6 border border-primary/20">
              <div className="font-mono text-sm text-primary space-y-2">
                <div>→ Analyzing requirements...</div>
                <div>→ Generating React components...</div>
                <div>→ Applying responsive design...</div>
                <div className="text-green-400 flex items-center gap-2">
                  <Check className="w-4 h-4" /> Complete! 3 files generated in 2.4s
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-center">
              <Button variant="gradient" asChild>
                <Link href="/builder">
                  <Play className="w-4 h-4 mr-2" />
                  Try It Yourself
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <Card className="p-12 bg-gradient-to-br from-primary/20 to-secondary/20 border-primary/30 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white break-words leading-snug">
              Ready to Squeeze Fresh Code?
            </h2>
            <p className="text-xl text-slate-300 mb-8 break-words whitespace-normal">
              When code throws you lemons, Lomu makes it sweet
            </p>
            <Button size="lg" variant="gradient" data-testid="button-cta" asChild>
              <Link href="/builder">
                <Rocket className="w-5 h-5 mr-2" />
                Start Building Free
              </Link>
            </Button>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center text-slate-500">
            <div className="flex items-center justify-center gap-3 mb-4">
              <LomuTextLogo size="default" />
            </div>
            <p className="text-sm mb-4 break-words">© 2025 Lomu. When code throws you lemons, you get Lomu.</p>
            
            {/* AI Disclaimer in Footer */}
            <div className="max-w-3xl mx-auto mb-6">
              <p className="text-xs text-slate-500 break-words whitespace-normal">
                AI-generated code requires human review and testing. Results may vary based on project complexity. 
                Lomu is an AI-assisted development tool - not a replacement for skilled developers.
              </p>
            </div>
            
            <DeploymentStatus />
          </div>
        </div>
      </footer>
    </div>
  );
}
