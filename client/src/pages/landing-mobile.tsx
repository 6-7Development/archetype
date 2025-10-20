import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MotionToggle } from "@/components/motion-toggle";
import { Sparkles, Zap, Shield, Code, Check, ArrowRight, Menu } from "lucide-react";
import logoPath from "@assets/logo.svg";
import { motion } from "framer-motion";
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
              <img src={logoPath} alt="ARCHETYPE" className="w-10 h-10 flex-shrink-0 rounded-lg" />
              <span className="text-sm sm:text-base md:text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent truncate">
                ARCHETYPE
              </span>
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

      {/* Hero Section - Mobile Optimized */}
      <section className="pt-24 pb-12 px-4">
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
            <img 
              src={logoPath} 
              alt="ARCHETYPE" 
              className="w-20 h-20 mx-auto rounded-2xl shadow-2xl shadow-cyan-500/50"
            />
          </motion.div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                AI-Powered
              </span>
              <br />
              <span className="text-white">Code Generation</span>
            </h1>
            
            <p className="text-slate-300 text-base max-w-sm mx-auto">
              Build complete websites and web apps instantly with natural language commands
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
        </div>
      </section>

      {/* Features - Mobile Stack */}
      <section className="py-12 px-4">
        <div className="max-w-md mx-auto space-y-4">
          <h2 className="text-2xl font-bold text-center mb-6">
            <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Why Choose ARCHETYPE
            </span>
          </h2>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white">AI-Powered</h3>
            <p className="text-slate-300 text-sm">
              Claude Sonnet 4 generates production-ready code instantly
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white">Lightning Fast</h3>
            <p className="text-slate-300 text-sm">
              Build complete projects in minutes, not weeks
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Code className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white">Full Stack</h3>
            <p className="text-slate-300 text-sm">
              Frontend, backend, database - everything generated for you
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white">Enterprise Ready</h3>
            <p className="text-slate-300 text-sm">
              Production-grade security and scalability built-in
            </p>
          </Card>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-12 px-4">
        <div className="max-w-md mx-auto">
          <Card className="p-6 text-center space-y-4 border-cyan-500/30">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-400 font-medium">Limited Time Offer</span>
            </div>
            
            <h3 className="text-2xl font-bold text-white">Start Free</h3>
            <p className="text-slate-300 text-sm">
              3 AI projects included. No credit card required.
            </p>

            <ul className="text-left space-y-2 py-4">
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300">AI code generation</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300">Live preview & editing</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300">Download projects</span>
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
            <img src={logoPath} alt="ARCHETYPE" className="w-8 h-8 rounded-lg" />
            <span className="font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              ARCHETYPE
            </span>
          </div>
          <p className="text-sm text-slate-400">
            AI-Powered Code Generation Platform
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/pricing" className="text-slate-400 hover:text-cyan-400 transition-colors min-h-[44px] flex items-center px-2" data-testid="footer-link-pricing">
              Pricing
            </Link>
            <Link href="/builder" className="text-slate-400 hover:text-cyan-400 transition-colors min-h-[44px] flex items-center px-2" data-testid="footer-link-builder">
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
