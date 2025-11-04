import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MotionToggle } from "@/components/motion-toggle";
import { Sparkles, Zap, Shield, Code, Check, ArrowRight, Menu, Play, Rocket } from "lucide-react";
import { LomuTextLogo } from '@/components/final-logos';
import { useState } from "react";

export default function LandingMobile() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Mobile Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
        <div className="px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <Link href="/" className="flex items-center gap-2 min-h-[44px] py-1 flex-1 min-w-0 max-w-[60%]" data-testid="link-brand">
              <LomuTextLogo size="sm" />
            </Link>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <MotionToggle />
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                onClick={() => setMenuOpen(!menuOpen)}
                data-testid="button-mobile-menu"
                aria-label="Toggle menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {menuOpen && (
            <div className="mt-4 pb-2 space-y-2">
              <Button variant="ghost" className="w-full justify-start min-h-[44px]" asChild data-testid="menu-link-home">
                <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start min-h-[44px]" asChild data-testid="menu-link-pricing">
                <Link href="/pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
              </Button>
              <Button variant="outline" className="w-full min-h-[44px]" asChild data-testid="menu-link-login">
                <Link href="/auth" onClick={() => setMenuOpen(false)}>Login</Link>
              </Button>
              <Button variant="default" className="w-full min-h-[44px]" asChild data-testid="menu-link-builder">
                <Link href="/builder" onClick={() => setMenuOpen(false)}>Get Started</Link>
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section - Mobile Optimized */}
      <section className="pt-24 pb-12 px-4">
        <div className="text-center space-y-6">
          <div className="inline-block">
            <LomuTextLogo size="default" />
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight break-words">
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent break-words">
                Build Full-Stack Apps
              </span>
              <br />
              <span className="text-white break-words">With AI in Seconds</span>
            </h1>
            
            <p className="text-slate-300 text-base max-w-sm mx-auto break-words whitespace-normal">
              Claude Sonnet 4 powered. Zero coding required. Production-ready in minutes.
            </p>
          </div>

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Button size="lg" className="w-full min-h-[44px] py-3" asChild data-testid="button-cta-mobile">
              <Link href="/builder">
                Start Building Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full min-h-[44px] py-3 text-white border-slate-600" asChild data-testid="button-cta-pricing-mobile">
              <Link href="/pricing">
                View Pricing
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-8 px-4">
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
          {[
            { value: "Sonnet 4", label: "Claude AI" },
            { value: "12-Step", label: "AI Workflow" },
            { value: "Full Stack", label: "Web Expertise" },
            { value: "2D/3D", label: "Game Support" }
          ].map((stat, i) => (
            <div key={i} className="text-center p-4 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Screenshots - Mobile */}
      <section className="py-12 px-4 bg-slate-900/50">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8 text-white">
            See the Platform in Action
          </h2>
          
          <div className="space-y-6">
            {/* Screenshot 1: Workspace */}
            <Card className="p-4 bg-slate-800 border-slate-700">
              <div className="aspect-video bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-center">
                <div className="text-center">
                  <Code className="w-10 h-10 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-slate-400">4-Panel IDE</p>
                </div>
              </div>
              <h3 className="mt-3 font-semibold text-white text-sm">Professional IDE Experience</h3>
              <p className="text-xs text-slate-400 mt-1">Split-pane editor, live preview, AI chat, terminal</p>
            </Card>

            {/* Screenshot 2: AI Building */}
            <Card className="p-4 bg-slate-800 border-slate-700">
              <div className="aspect-video bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-10 h-10 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-slate-400">AI in Action</p>
                </div>
              </div>
              <h3 className="mt-3 font-semibold text-white text-sm">Watch AI Code in Real-Time</h3>
              <p className="text-xs text-slate-400 mt-1">See LomuAI generate and test automatically</p>
            </Card>

            {/* Screenshot 3: Live Preview */}
            <Card className="p-4 bg-slate-800 border-slate-700">
              <div className="aspect-video bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-center">
                <div className="text-center">
                  <Play className="w-10 h-10 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-slate-400">Live Preview</p>
                </div>
              </div>
              <h3 className="mt-3 font-semibold text-white text-sm">Instant Visual Feedback</h3>
              <p className="text-xs text-slate-400 mt-1">Changes reflected immediately as AI codes</p>
            </Card>

            {/* Screenshot 4: Deployment */}
            <Card className="p-4 bg-slate-800 border-slate-700">
              <div className="aspect-video bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-center">
                <div className="text-center">
                  <Rocket className="w-10 h-10 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-slate-400">Deployment</p>
                </div>
              </div>
              <h3 className="mt-3 font-semibold text-white text-sm">One-Click Deployment</h3>
              <p className="text-xs text-slate-400 mt-1">Deploy with custom domains and SSL automatically</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Features - Mobile Stack */}
      <section className="py-12 px-4">
        <div className="max-w-md mx-auto space-y-4">
          <h2 className="text-2xl font-bold text-center mb-6 break-words leading-snug">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent break-words">
              Why Choose Lomu
            </span>
          </h2>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white break-words">Lightning Fast</h3>
            <p className="text-slate-300 text-sm break-words whitespace-normal">
              12-step AI workflow delivers production-ready code in minutes
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white break-words">Enterprise Quality</h3>
            <p className="text-slate-300 text-sm break-words whitespace-normal">
              Self-testing, validation, and security audits built-in
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
              <Code className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white break-words">100% Transparent</h3>
            <p className="text-slate-300 text-sm break-words whitespace-normal">
              See exact cost before building. Fair pricing at $1.50 per 1,000 overage tokens
            </p>
          </Card>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-12 px-4">
        <div className="max-w-md mx-auto">
          <Card className="p-6 text-center space-y-4 border-primary/30">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Limited Time Offer</span>
            </div>
            
            <h3 className="text-2xl font-bold text-white break-words leading-snug">Start Free</h3>
            <p className="text-slate-300 text-sm break-words whitespace-normal">
              3 AI projects included. No credit card required.
            </p>

            <ul className="text-left space-y-2 py-4">
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300 break-words">AI code generation</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300 break-words">Live preview & editing</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300 break-words">Download projects</span>
              </li>
            </ul>

            <Button size="lg" className="w-full min-h-[44px] py-3" asChild data-testid="button-footer-cta">
              <Link href="/builder">Get Started Free</Link>
            </Button>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4">
        <div className="max-w-md mx-auto text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <LomuTextLogo size="sm" />
          </div>
          <p className="text-sm text-slate-400 break-words whitespace-normal">
            When code throws you lemons, you get Lomu
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/pricing" className="text-slate-400 hover:text-primary transition-colors min-h-[44px] flex items-center px-2" data-testid="footer-link-pricing">
              Pricing
            </Link>
            <Link href="/builder" className="text-slate-400 hover:text-primary transition-colors min-h-[44px] flex items-center px-2" data-testid="footer-link-builder">
              Get Started
            </Link>
          </div>
          
          {/* AI Disclaimer in Footer */}
          <div className="max-w-sm mx-auto pt-4">
            <p className="text-xs text-slate-500 break-words whitespace-normal">
              AI-generated code requires human review and testing. Results may vary based on project complexity. 
              Lomu is an AI-assisted development tool - not a replacement for skilled developers.
            </p>
          </div>
          
          <p className="text-xs text-slate-500">
            © 2025 <span className="font-semibold text-slate-400">Drill Consulting 360 LLC</span>. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
