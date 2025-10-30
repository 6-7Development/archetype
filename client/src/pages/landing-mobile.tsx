import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MotionToggle } from "@/components/motion-toggle";
import { Sparkles, Zap, Shield, Code, Check, ArrowRight, Menu, Info } from "lucide-react";
import { LogoEnhancedBadge, LomuTextLogo } from '@/components/final-logos';
import { motion } from "framer-motion";
import { useState } from "react";
import { taglines } from '@/lib/taglines';
import { BillboardBanner } from '@/components/billboard-banner';

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
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 pb-2 space-y-2"
            >
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
            </motion.div>
          )}
        </div>
      </nav>

      {/* Billboard Banner */}
      <div className="pt-20 pb-4 px-4 relative z-20">
        <BillboardBanner
          type="announcement"
          title="New Feature: LomuAI Auto-Healing!"
          description="Our AI now automatically fixes bugs and deploys updates - watch your platform heal itself in real-time"
          ctaText="See It In Action"
          ctaLink="/platform-healing"
          animated={true}
          dismissible={true}
        />
      </div>

      {/* Hero Section - Mobile Optimized */}
      <section className="pt-6 pb-12 px-4">
        <div className="text-center space-y-6">
          {/* Pulsing Logo */}
          <motion.div
            className="inline-block motion-safe-only"
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            aria-hidden="true"
          >
            <LomuTextLogo size="default" />
          </motion.div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight break-words">
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent break-words">
                Squeeze Fresh Code
              </span>
              <br />
              <span className="text-white break-words">With Lomu</span>
            </h1>
            
            <p className="text-slate-300 text-base max-w-sm mx-auto break-words whitespace-normal">
              {taglines.hero[0]} Build complete websites and web apps instantly with AI.
            </p>
          </div>

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Button size="lg" className="w-full min-h-[44px] py-3" asChild data-testid="button-cta-mobile">
              <Link href="/builder">
                Start Building Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full min-h-[44px] py-3" asChild data-testid="button-cta-pricing">
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>

          {/* AI Disclaimer */}
          <div className="mt-8 max-w-md mx-auto" data-testid="section-ai-disclaimer">
            <div className="inline-flex items-start gap-2 px-4 py-3 rounded-lg bg-slate-800/30 border border-slate-700/50 w-full">
              <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-400 text-left break-words whitespace-normal">
                AI-generated code requires human review and testing. Results may vary based on project complexity. Lomu is an AI-assisted development tool - not a replacement for skilled developers.
              </p>
            </div>
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
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white break-words">AI-Powered</h3>
            <p className="text-slate-300 text-sm break-words whitespace-normal">
              Claude Sonnet 4 generates production-ready code instantly
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white break-words">Lightning Fast</h3>
            <p className="text-slate-300 text-sm break-words whitespace-normal">
              Build complete projects in minutes, not weeks
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
              <Code className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white break-words">Full Stack</h3>
            <p className="text-slate-300 text-sm break-words whitespace-normal">
              Frontend, backend, database - everything generated for you
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white break-words">Enterprise Ready</h3>
            <p className="text-slate-300 text-sm break-words whitespace-normal">
              Production-grade security and scalability built-in
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
            {taglines.footer[0]}
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/pricing" className="text-slate-400 hover:text-primary transition-colors min-h-[44px] flex items-center px-2" data-testid="footer-link-pricing">
              Pricing
            </Link>
            <Link href="/builder" className="text-slate-400 hover:text-primary transition-colors min-h-[44px] flex items-center px-2" data-testid="footer-link-builder">
              Get Started
            </Link>
          </div>
          <p className="text-xs text-slate-500">
            © 2025 <span className="font-semibold text-slate-400">Drill Consulting 360 LLC</span>. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
