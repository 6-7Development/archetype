import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MotionToggle } from "@/components/motion-toggle";
import { Sparkles, Zap, Shield, Code, Check, ArrowRight, Menu, Play, Rocket, Hexagon } from "lucide-react";
import { useState } from "react";
import beehiveLogo from "@assets/image_1762635565078.png";
import beehiveWordLogo from "@assets/image_1762635590698.png";

export default function LandingMobile() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-charcoal-950">
      {/* Mobile Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-honey/10 bg-charcoal-950/95 backdrop-blur-xl">
        <div className="px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <Link href="/" className="flex items-center gap-2 min-h-[44px] py-1 flex-1 min-w-0 max-w-[60%]" data-testid="link-brand">
              <img 
                src={beehiveLogo} 
                alt="BeehiveAI" 
                className="h-8 w-8 object-contain flex-shrink-0"
              />
              <span className="text-lg font-bold text-white truncate">BeehiveAI</span>
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
              <Button className="w-full min-h-[44px] bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold" asChild data-testid="menu-link-builder">
                <Link href="/builder" onClick={() => setMenuOpen(false)}>Get Started</Link>
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section - Mobile Optimized */}
      <section className="pt-24 pb-12 px-4">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-honey/30 bg-honey/10">
            <Sparkles className="w-4 h-4 text-honey" />
            <span className="text-xs text-honey font-medium">Powered by Claude Sonnet 4</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight break-words">
              <span className="bg-gradient-to-r from-honey via-nectar to-mint bg-clip-text text-transparent break-words">
                Build Full-Stack Apps
              </span>
              <br />
              <span className="text-white break-words">With AI in Seconds</span>
            </h1>
            
            <p className="text-slate-400 text-base max-w-sm mx-auto break-words whitespace-normal">
              Your hive of AI workers, buzzing with precision. Zero coding required—just sweet results.
            </p>
          </div>

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Button size="lg" className="w-full min-h-[44px] py-3 bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold" asChild data-testid="button-cta-mobile">
              <Link href="/builder">
                <Zap className="w-4 h-4 mr-2" />
                Start Building Free
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full min-h-[44px] py-3 text-white border-white/20 hover:bg-white/5" asChild data-testid="button-cta-pricing-mobile">
              <Link href="/pricing">
                View Pricing
                <ArrowRight className="w-4 h-4 ml-2" />
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
            <div key={i} className="text-center p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="text-xl font-bold text-honey">
                {stat.value}
              </div>
              <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
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
              <h3 className="mt-3 font-semibold text-white text-sm">Your Honeycomb Workspace</h3>
              <p className="text-xs text-slate-400 mt-1">Perfectly structured like hexagonal cells—editor, preview, chat, terminal</p>
            </Card>

            {/* Screenshot 2: AI Building */}
            <Card className="p-4 bg-slate-800 border-slate-700">
              <div className="aspect-video bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-10 h-10 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-slate-400">AI in Action</p>
                </div>
              </div>
              <h3 className="mt-3 font-semibold text-white text-sm">Watch the Swarm Build</h3>
              <p className="text-xs text-slate-400 mt-1">AI agents coding in perfect harmony—ship production apps faster</p>
            </Card>

            {/* Screenshot 3: Live Preview */}
            <Card className="p-4 bg-slate-800 border-slate-700">
              <div className="aspect-video bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-center">
                <div className="text-center">
                  <Play className="w-10 h-10 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-slate-400">Live Preview</p>
                </div>
              </div>
              <h3 className="mt-3 font-semibold text-white text-sm">Honey Crystallizing</h3>
              <p className="text-xs text-slate-400 mt-1">Watch your app form like golden honey—instant live preview</p>
            </Card>

            {/* Screenshot 4: Deployment */}
            <Card className="p-4 bg-slate-800 border-slate-700">
              <div className="aspect-video bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-center">
                <div className="text-center">
                  <Rocket className="w-10 h-10 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-slate-400">Deployment</p>
                </div>
              </div>
              <h3 className="mt-3 font-semibold text-white text-sm">Harvest the Honey</h3>
              <p className="text-xs text-slate-400 mt-1">Take your sweet creation live—one click to production</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Features - Mobile Stack */}
      <section className="py-12 px-4">
        <div className="max-w-md mx-auto space-y-4">
          <h2 className="text-2xl font-bold text-center mb-6 break-words leading-snug">
            <span className="bg-gradient-to-r from-honey to-mint bg-clip-text text-transparent break-words">
              Why Choose BeehiveAI
            </span>
          </h2>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-honey to-nectar flex items-center justify-center">
              <Zap className="w-6 h-6 text-charcoal-950" />
            </div>
            <h3 className="text-lg font-semibold text-white break-words">Bee-Line Fast</h3>
            <p className="text-slate-300 text-sm break-words whitespace-normal">
              Swarm takes the shortest path—production code delivered in minutes, fully tested
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-mint to-honey flex items-center justify-center">
              <Shield className="w-6 h-6 text-charcoal-950" />
            </div>
            <h3 className="text-lg font-semibold text-white break-words">Queen Bee Quality</h3>
            <p className="text-slate-300 text-sm break-words whitespace-normal">
              Royal guard inspection—every line tested, validated, and golden-perfect
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-nectar to-mint flex items-center justify-center">
              <Code className="w-6 h-6 text-charcoal-950" />
            </div>
            <h3 className="text-lg font-semibold text-white break-words">Clear as Honey</h3>
            <p className="text-slate-300 text-sm break-words whitespace-normal">
              See exactly what you're getting—transparent pricing, no sticky surprises
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

            <Button size="lg" className="w-full min-h-[44px] py-3 bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold" asChild data-testid="button-footer-cta">
              <Link href="/builder">Get Started Free</Link>
            </Button>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4">
        <div className="max-w-md mx-auto text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <img 
              src={beehiveLogo} 
              alt="BeehiveAI" 
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-bold text-white">BeehiveAI</span>
          </div>
          <p className="text-sm text-slate-400 break-words whitespace-normal">
            Where code gets sweeter by the hive
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
              BeehiveAI is an AI-assisted development tool - not a replacement for skilled developers.
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
