import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MotionToggle } from "@/components/motion-toggle";
import { BeehiveLogo, SimplifiedMobileLogo } from "@/components/beehive-logos";
import { 
  Sparkles, Zap, Shield, Code, Rocket, Check, 
  Play, ArrowRight, Hexagon, Menu, DollarSign, LogIn 
} from "lucide-react";
import { useState } from "react";

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-charcoal-950 relative overflow-hidden">
      {/* Subtle honeycomb pattern background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23F7B500' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Responsive Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-honey/10 bg-charcoal-950/90 backdrop-blur-xl">
        <div className="container mx-auto px-3 sm:px-6 py-2 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            {/* Logo - Responsive sizing */}
            <Link 
              href="/" 
              data-testid="link-home"
              className="inline-flex items-center hover-elevate rounded-md px-1 py-0.5 sm:px-2 sm:py-1"
            >
              <BeehiveLogo size="default" className="hidden md:block" />
              <SimplifiedMobileLogo className="md:hidden" />
            </Link>
            
            {/* Desktop Navigation - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-3">
              <Button 
                variant="ghost" 
                className="text-white/80 hover:text-white" 
                data-testid="button-nav-pricing" 
                asChild
              >
                <Link href="/pricing">View Pricing</Link>
              </Button>
              <Button 
                variant="ghost" 
                className="text-white/80 hover:text-white" 
                data-testid="button-nav-login" 
                asChild
              >
                <Link href="/auth">Login</Link>
              </Button>
              <Button 
                className="bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold" 
                data-testid="button-nav-get-started" 
                asChild
              >
                <Link href="/builder">Get Started</Link>
              </Button>
            </div>

            {/* Mobile Menu Button - Shown on mobile only */}
            <div className="flex md:hidden items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="min-h-[40px] min-w-[40px]"
                onClick={() => setMenuOpen(!menuOpen)}
                data-testid="button-mobile-menu"
                aria-label="Toggle menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Mobile Dropdown Menu */}
          {menuOpen && (
            <div className="md:hidden mt-4 pb-2 space-y-2">
              <Button 
                variant="ghost" 
                className="w-full min-h-[44px]" 
                asChild 
                data-testid="menu-link-pricing"
              >
                <Link href="/pricing" onClick={() => setMenuOpen(false)}>
                  <span className="flex items-center gap-2 w-full">
                    <DollarSign className="w-4 h-4" />
                    Pricing
                  </span>
                </Link>
              </Button>
              <Button 
                variant="outline" 
                className="w-full min-h-[44px]" 
                asChild 
                data-testid="menu-link-login"
              >
                <Link href="/auth" onClick={() => setMenuOpen(false)}>
                  <span className="flex items-center gap-2 w-full">
                    <LogIn className="w-4 h-4" />
                    Login
                  </span>
                </Link>
              </Button>
              <Button 
                className="w-full min-h-[44px] bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold" 
                asChild 
                data-testid="menu-link-builder"
              >
                <Link href="/builder" onClick={() => setMenuOpen(false)}>
                  <span className="flex items-center gap-2 w-full">
                    <Rocket className="w-4 h-4" />
                    Get Started
                  </span>
                </Link>
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section - Responsive */}
      <section className="pt-20 sm:pt-28 md:pt-32 pb-8 sm:pb-16 md:pb-20 px-3 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-6xl text-center">
          {/* Powered by Badge */}
          <div className="mb-4 sm:mb-8 inline-flex items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-6 sm:py-3 rounded-full bg-honey/10 backdrop-blur-sm shadow-[inset_0_0_0_1px_rgba(247,181,0,0.2)]">
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-honey flex-shrink-0" />
            <span className="text-[11px] sm:text-sm text-honey font-medium">Gemini 2.5 Flash + Claude Sonnet 4</span>
          </div>
          
          {/* Main Headline - Fluid responsive sizing */}
          <h1 className="font-bold mb-3 sm:mb-6 leading-tight tracking-tight" style={{ fontSize: 'clamp(2rem, 6vw, 4.5rem)' }}>
            <span className="bg-gradient-to-r from-honey via-nectar to-mint bg-clip-text text-transparent text-balance">
              Build Full-Stack Apps With AI in Minutes
            </span>
          </h1>
          
          <p className="text-sm sm:text-lg md:text-xl text-slate-400 mb-6 sm:mb-10 max-w-3xl mx-auto">
            Like a hive of expert developers working in perfect harmony. Zero coding required—just pure honey-sweet results.
          </p>

          {/* CTAs - Stack on mobile, row on desktop */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center items-stretch sm:items-center mb-8 sm:mb-16 md:mb-20 max-w-xs sm:max-w-none mx-auto">
            <Button 
              size="lg" 
              className="w-full sm:w-auto min-h-[44px] bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold text-base px-8" 
              data-testid="button-hero-start" 
              asChild
            >
              <Link href="/builder">
                <span className="flex items-center gap-2">
                  <Zap className="w-4 sm:w-5 h-4 sm:h-5" />
                  Start Building Free
                </span>
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full sm:w-auto min-h-[44px] text-white border-white/20 hover:bg-white/5" 
              data-testid="button-hero-pricing" 
              asChild
            >
              <Link href="/pricing">
                <span className="flex items-center gap-2">
                  View Pricing
                  <ArrowRight className="w-4 sm:w-5 h-4 sm:h-5" />
                </span>
              </Link>
            </Button>
          </div>

          {/* Feature Stats - 2 cols mobile, 4 cols desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {[
              { value: "Sonnet 4", label: "Claude AI" },
              { value: "7-Phase", label: "AI Workflow" },
              { value: "Full Stack", label: "Web Expertise" },
              { value: "2D/3D", label: "Game Support" }
            ].map((stat, i) => (
              <div key={i} className="text-center p-3 sm:p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-xl sm:text-2xl font-bold text-honey mb-1">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Screenshots Section - Responsive */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 relative">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 text-white break-words">
            See the Platform in Action
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Screenshot 1: AI Chat */}
            <Card className="p-4 sm:p-6 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate">
              <div className="aspect-video bg-slate-950/50 rounded-lg border border-slate-700/50 flex items-center justify-center mb-3 sm:mb-4">
                <div className="text-center">
                  <Sparkles className="w-10 sm:w-12 h-10 sm:h-12 mx-auto mb-2 sm:mb-3 text-honey" />
                  <p className="text-sm text-slate-300 font-medium">AI Chat Interface</p>
                  <p className="text-xs text-slate-500 mt-1">Real-time code generation</p>
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2 break-words">Chat with the Hive</h3>
              <p className="text-sm text-slate-400 break-words">
                Tell the swarm what you need—watch specialized AI workers build your app with hive-mind precision
              </p>
            </Card>

            {/* Screenshot 2: Live Preview */}
            <Card className="p-4 sm:p-6 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate">
              <div className="aspect-video bg-slate-950/50 rounded-lg border border-slate-700/50 flex items-center justify-center mb-3 sm:mb-4">
                <div className="text-center">
                  <Play className="w-10 sm:w-12 h-10 sm:h-12 mx-auto mb-2 sm:mb-3 text-mint" />
                  <p className="text-sm text-slate-300 font-medium">Live Preview</p>
                  <p className="text-xs text-slate-500 mt-1">Instant visual feedback</p>
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2 break-words">Watch the Hive Work</h3>
              <p className="text-sm text-slate-400 break-words">
                See your app crystallize like honey as our worker bees code in real-time
              </p>
            </Card>

            {/* Screenshot 3: Code Editor */}
            <Card className="p-4 sm:p-6 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate">
              <div className="aspect-video bg-slate-950/50 rounded-lg border border-slate-700/50 flex items-center justify-center mb-3 sm:mb-4">
                <div className="text-center">
                  <Code className="w-10 sm:w-12 h-10 sm:h-12 mx-auto mb-2 sm:mb-3 text-honey" />
                  <p className="text-sm text-slate-300 font-medium">Monaco Editor</p>
                  <p className="text-xs text-slate-500 mt-1">Full IDE in browser</p>
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2 break-words">Your Personal Honeycomb</h3>
              <p className="text-sm text-slate-400 break-words">
                Every file perfectly organized in hexagonal precision—full IDE power at your fingertips
              </p>
            </Card>

            {/* Screenshot 4: Deployment */}
            <Card className="p-4 sm:p-6 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate">
              <div className="aspect-video bg-slate-950/50 rounded-lg border border-slate-700/50 flex items-center justify-center mb-3 sm:mb-4">
                <div className="text-center">
                  <Rocket className="w-10 sm:w-12 h-10 sm:h-12 mx-auto mb-2 sm:mb-3 text-mint" />
                  <p className="text-sm text-slate-300 font-medium">Production Deployment</p>
                  <p className="text-xs text-slate-500 mt-1">Production hosting</p>
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2 break-words">Harvest Your Creation</h3>
              <p className="text-sm text-slate-400 break-words">
                Deploy to production with Cloudflare Pages—custom domains and SSL included
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Features - Responsive Grid */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 relative">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 break-words">
              <span className="bg-gradient-to-r from-honey to-mint bg-clip-text text-transparent">
                Why Choose BeehiveAI
              </span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-slate-400 break-words">Swarm intelligence for modern development</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Speed */}
            <Card className="p-6 sm:p-8 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate h-full">
              <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-honey/20 flex items-center justify-center text-honey mb-4 sm:mb-6">
                <Zap className="w-6 sm:w-7 h-6 sm:h-7" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-white break-words">Bee-Line to Production</h3>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed break-words">
                Our swarm takes the most efficient path. 12-step workflow delivers production-ready code in minutes—tested and deployed.
              </p>
            </Card>

            {/* Quality */}
            <Card className="p-6 sm:p-8 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate h-full">
              <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-mint/20 flex items-center justify-center text-mint mb-4 sm:mb-6">
                <Shield className="w-6 sm:w-7 h-6 sm:h-7" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-white break-words">Queen Bee Quality</h3>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed break-words">
                Every line inspected by our royal guard—self-testing, validation, and security audits ensure golden-standard code
              </p>
            </Card>

            {/* Swarm */}
            <Card className="p-6 sm:p-8 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate h-full">
              <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-honey/20 flex items-center justify-center text-honey mb-4 sm:mb-6">
                <Hexagon className="w-6 sm:w-7 h-6 sm:h-7" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-white break-words">Hive Mind Power</h3>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed break-words">
                Specialized AI workers buzzing in perfect sync—planning, building, testing, deploying. Ship faster with true collaboration.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section - Responsive */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 relative">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="p-8 sm:p-10 md:p-12 rounded-2xl bg-gradient-to-br from-honey/10 to-mint/10 border border-honey/20 backdrop-blur-sm">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-white break-words">
              Ready to Taste the Honey?
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-slate-300 mb-6 sm:mb-8 break-words">
              Join developers worldwide shipping production apps in minutes, not months
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-xs sm:max-w-none mx-auto">
              <Button 
                size="lg" 
                className="w-full sm:w-auto min-h-[44px] bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold text-base px-8" 
                data-testid="button-cta-start"
                asChild
              >
                <Link href="/builder">
                  <span className="flex items-center gap-2">
                    <Rocket className="w-4 sm:w-5 h-4 sm:h-5" />
                    Start Building Free
                  </span>
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto min-h-[44px] text-white border-white/20 hover:bg-white/5" 
                data-testid="button-cta-pricing"
                asChild
              >
                <Link href="/pricing">View Pricing Plans</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Responsive */}
      <footer className="border-t border-white/10 py-6 sm:py-8 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <BeehiveLogo size="sm" />
            <p className="text-slate-500 text-sm">
              © 2024 BeehiveAI. Where code gets sweeter by the hive.
            </p>
            <div className="flex gap-4 flex-wrap justify-center">
              <Link href="/pricing" className="text-slate-400 hover:text-white text-sm min-h-[44px] flex items-center" data-testid="footer-link-pricing">
                Pricing
              </Link>
              <Link href="/support" className="text-slate-400 hover:text-white text-sm min-h-[44px] flex items-center" data-testid="footer-link-support">
                Support
              </Link>
              <Link href="/auth" className="text-slate-400 hover:text-white text-sm min-h-[44px] flex items-center" data-testid="footer-link-login">
                Login
              </Link>
            </div>
          </div>
          
          {/* AI Disclaimer */}
          <div className="max-w-3xl mx-auto pt-6 sm:pt-8 mt-6 sm:mt-8 border-t border-white/10">
            <p className="text-xs text-slate-500 text-center break-words whitespace-normal">
              AI-generated code requires human review and testing. Results may vary based on project complexity. 
              BeehiveAI is an AI-assisted development tool - not a replacement for skilled developers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
