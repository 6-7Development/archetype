import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MotionToggle } from "@/components/motion-toggle";
import { BeehiveLogo, SimplifiedMobileLogo, BeehiveIcon } from "@/components/beehive-logos";
import { 
  Sparkles, Zap, Shield, Code, Rocket, Check, 
  Play, ArrowRight, Hexagon, Menu, DollarSign, LogIn 
} from "lucide-react";
import { useState } from "react";

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle honeycomb pattern background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23F7B500' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Responsive Navigation - Accommodates larger logo */}
      <nav className="fixed top-0 w-full z-50 border-b border-honey/10 bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto px-3 sm:px-6 py-2 sm:py-3 md:py-4 min-h-[60px] sm:min-h-[70px] md:min-h-[140px]">
          <div className="flex flex-wrap items-center justify-between gap-4 md:gap-6">
            {/* Logo - Responsive sizing with flex-shrink-0 */}
            <Link 
              href="/" 
              data-testid="link-home"
              className="inline-flex items-center hover-elevate rounded-md px-1 py-0.5 sm:px-2 sm:py-1 flex-shrink-0"
            >
              <BeehiveLogo size="default" className="hidden lg:block max-w-[360px] xl:max-w-[480px]" />
              <SimplifiedMobileLogo className="lg:hidden" />
            </Link>
            
            {/* Desktop Navigation - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-3 flex-shrink-0">
              <Button 
                variant="ghost" 
                className="text-foreground/80 hover:text-foreground" 
                data-testid="button-nav-pricing" 
                asChild
              >
                <Link href="/pricing">View Pricing</Link>
              </Button>
              <Button 
                variant="ghost" 
                className="text-foreground/80 hover:text-foreground" 
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
                className="min-h-[44px] min-w-[44px]"
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

      {/* Hero Section - Responsive with proper spacing to clear fixed header */}
      <section className="pt-32 sm:pt-36 md:pt-44 pb-12 sm:pb-20 md:pb-24 px-3 sm:px-6 relative z-10">
        <div className="container mx-auto max-w-6xl text-center">
          {/* Powered by Badge - Visible below header */}
          <div className="mb-6 sm:mb-8 inline-flex items-center gap-2 px-4 py-2 sm:gap-3 sm:px-6 sm:py-3 rounded-full bg-gradient-to-r from-honey/5 via-nectar/5 to-mint/5 border border-honey/20 backdrop-blur-sm shadow-sm hover-elevate transition-all duration-300" data-testid="badge-hero-stack">
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-honey flex-shrink-0 animate-pulse" />
            <span className="text-xs sm:text-sm bg-gradient-to-r from-honey via-nectar to-mint bg-clip-text text-transparent font-semibold">Gemini 2.5 Flash + Claude Sonnet 4</span>
          </div>
          
          {/* Main Headline - Fluid responsive sizing */}
          <h1 className="font-bold mb-4 sm:mb-6 leading-[1.1] tracking-tight" style={{ fontSize: 'clamp(2.25rem, 7vw, 5rem)' }} data-testid="heading-hero">
            <span className="bg-gradient-to-r from-honey via-nectar to-mint bg-clip-text text-transparent text-balance inline-block">
              Build Full-Stack Apps With AI in Minutes
            </span>
          </h1>
          
          <p className="text-base sm:text-xl md:text-2xl text-muted-foreground mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed font-light" data-testid="text-hero-subtitle">
            Like a hive of expert developers working in perfect harmony. Zero coding required—just pure honey-sweet results.
          </p>

          {/* CTAs - Stack on mobile, row on desktop */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center mb-12 sm:mb-20 md:mb-24 max-w-xs sm:max-w-none mx-auto">
            <Button 
              size="lg" 
              className="w-full sm:w-auto min-h-[52px] bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold text-base sm:text-lg px-8 sm:px-10 shadow-lg shadow-honey/20 transition-all duration-300" 
              data-testid="button-hero-start" 
              asChild
            >
              <Link href="/builder">
                <span className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Start Building Free
                </span>
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full sm:w-auto min-h-[52px] text-foreground border-border hover:bg-muted text-base sm:text-lg px-8 sm:px-10 transition-all duration-300" 
              data-testid="button-hero-pricing" 
              asChild
            >
              <Link href="/pricing">
                <span className="flex items-center gap-2">
                  View Pricing
                  <ArrowRight className="w-5 h-5" />
                </span>
              </Link>
            </Button>
          </div>

          {/* Feature Stats - 2 cols mobile, 4 cols desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto">
            {[
              { value: "Sonnet 4", label: "Claude AI", icon: Sparkles, testId: "card-feature-sonnet4" },
              { value: "7-Phase", label: "AI Workflow", icon: Zap, testId: "card-feature-7phase" },
              { value: "Full Stack", label: "Web Expertise", icon: Code, testId: "card-feature-fullstack" },
              { value: "2D/3D", label: "Game Support", icon: Rocket, testId: "card-feature-games" }
            ].map((stat, i) => (
              <div 
                key={i} 
                data-testid={stat.testId}
                className="group text-center p-4 sm:p-6 rounded-xl bg-card border border-border hover-elevate transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <stat.icon className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-3 text-honey group-hover:scale-110 transition-transform duration-300" />
                <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-honey to-nectar bg-clip-text text-transparent mb-1">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Screenshots Section - Responsive with extra top spacing */}
      <section className="pt-20 sm:pt-24 md:pt-32 pb-16 sm:pb-20 md:pb-24 px-4 sm:px-6 relative">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-4 text-foreground break-words" data-testid="heading-platform">
              See the Platform in Action
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to build, test, and deploy production-ready applications
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* Screenshot 1: AI Chat */}
            <Card data-testid="card-screenshot-chat" className="group p-6 sm:p-8 bg-card border-border hover-elevate transition-all duration-300 shadow-sm hover:shadow-xl">
              <div className="aspect-video bg-gradient-to-br from-honey/5 to-nectar/5 rounded-xl border border-border flex items-center justify-center mb-5 relative">
                <div className="text-center z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-honey/10 border border-honey/20 mb-3 group-hover:scale-110 transition-transform duration-300">
                    <Sparkles className="w-8 sm:w-10 h-8 sm:h-10 text-honey" />
                  </div>
                  <p className="text-sm sm:text-base text-foreground/90 font-semibold">AI Chat Interface</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Real-time code generation</p>
                </div>
                {/* Decorative gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 break-words">Chat with the Hive</h3>
              <p className="text-sm sm:text-base text-muted-foreground break-words leading-relaxed">
                Tell the swarm what you need—watch specialized AI workers build your app with hive-mind precision
              </p>
            </Card>

            {/* Screenshot 2: Live Preview */}
            <Card data-testid="card-screenshot-preview" className="group p-6 sm:p-8 bg-card border-border hover-elevate transition-all duration-300 shadow-sm hover:shadow-xl">
              <div className="aspect-video bg-gradient-to-br from-mint/5 to-mint/10 rounded-xl border border-border flex items-center justify-center mb-5 relative">
                <div className="text-center z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-mint/10 border border-mint/20 mb-3 group-hover:scale-110 transition-transform duration-300">
                    <Play className="w-8 sm:w-10 h-8 sm:h-10 text-mint" />
                  </div>
                  <p className="text-sm sm:text-base text-foreground/90 font-semibold">Live Preview</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Instant visual feedback</p>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 break-words">Watch the Hive Work</h3>
              <p className="text-sm sm:text-base text-muted-foreground break-words leading-relaxed">
                See your app crystallize like honey as our worker bees code in real-time
              </p>
            </Card>

            {/* Screenshot 3: Code Editor */}
            <Card data-testid="card-screenshot-editor" className="group p-6 sm:p-8 bg-card border-border hover-elevate transition-all duration-300 shadow-sm hover:shadow-xl">
              <div className="aspect-video bg-gradient-to-br from-honey/5 to-nectar/5 rounded-xl border border-border flex items-center justify-center mb-5 relative">
                <div className="text-center z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-honey/10 border border-honey/20 mb-3 group-hover:scale-110 transition-transform duration-300">
                    <Code className="w-8 sm:w-10 h-8 sm:h-10 text-honey" />
                  </div>
                  <p className="text-sm sm:text-base text-foreground/90 font-semibold">Monaco Editor</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Full IDE in browser</p>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 break-words">Your Personal Honeycomb</h3>
              <p className="text-sm sm:text-base text-muted-foreground break-words leading-relaxed">
                Every file perfectly organized in hexagonal precision—full IDE power at your fingertips
              </p>
            </Card>

            {/* Screenshot 4: Deployment */}
            <Card data-testid="card-screenshot-deployment" className="group p-6 sm:p-8 bg-card border-border hover-elevate transition-all duration-300 shadow-sm hover:shadow-xl">
              <div className="aspect-video bg-gradient-to-br from-mint/5 to-mint/10 rounded-xl border border-border flex items-center justify-center mb-5 relative">
                <div className="text-center z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-mint/10 border border-mint/20 mb-3 group-hover:scale-110 transition-transform duration-300">
                    <Rocket className="w-8 sm:w-10 h-8 sm:h-10 text-mint" />
                  </div>
                  <p className="text-sm sm:text-base text-foreground/90 font-semibold">Production Deployment</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Production hosting</p>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 break-words">Harvest Your Creation</h3>
              <p className="text-sm sm:text-base text-muted-foreground break-words leading-relaxed">
                Deploy to production with Cloudflare Pages—custom domains and SSL included
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Features - Responsive Grid */}
      <section className="py-20 sm:py-24 md:py-32 px-4 sm:px-6 relative bg-gradient-to-b from-transparent via-honey/5 to-transparent">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 break-words" data-testid="heading-features">
              <span className="bg-gradient-to-r from-honey via-nectar to-mint bg-clip-text text-transparent">
                Why Choose BeehiveAI
              </span>
            </h2>
            <p className="text-base sm:text-xl text-muted-foreground break-words max-w-2xl mx-auto">
              Swarm intelligence for modern development
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Speed */}
            <Card className="group p-8 sm:p-10 bg-card border-border hover-elevate h-full transition-all duration-300 shadow-sm hover:shadow-lg" data-testid="card-feature-speed">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-honey/20 to-nectar/20 flex items-center justify-center text-honey mb-6 group-hover:scale-110 transition-transform duration-300 border border-honey/20">
                <Zap className="w-8 sm:w-10 h-8 sm:h-10" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4 text-foreground break-words">Bee-Line to Production</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed break-words">
                Our swarm takes the most efficient path. 7-phase workflow delivers production-ready code in minutes—tested and deployed.
              </p>
            </Card>

            {/* Quality */}
            <Card className="group p-8 sm:p-10 bg-card border-border hover-elevate h-full transition-all duration-300 shadow-sm hover:shadow-lg" data-testid="card-feature-quality">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-mint/20 to-mint/30 flex items-center justify-center text-mint mb-6 group-hover:scale-110 transition-transform duration-300 border border-mint/20">
                <Shield className="w-8 sm:w-10 h-8 sm:h-10" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4 text-foreground break-words">Queen Bee Quality</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed break-words">
                Every line inspected by our royal guard—self-testing, validation, and security audits ensure golden-standard code
              </p>
            </Card>

            {/* Swarm */}
            <Card className="group p-8 sm:p-10 bg-card border-border hover-elevate h-full transition-all duration-300 shadow-sm hover:shadow-lg sm:col-span-2 lg:col-span-1" data-testid="card-feature-swarm">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-honey/20 to-nectar/20 flex items-center justify-center text-honey mb-6 group-hover:scale-110 transition-transform duration-300 border border-honey/20">
                <Hexagon className="w-8 sm:w-10 h-8 sm:h-10" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4 text-foreground break-words">Hive Mind Power</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed break-words">
                Specialized AI workers buzzing in perfect sync—planning, building, testing, deploying. Ship faster with true collaboration.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section - Responsive */}
      <section className="py-20 sm:py-24 md:py-32 px-4 sm:px-6 relative overflow-hidden">
        <div className="container mx-auto max-w-5xl text-center relative z-10">
          <div className="relative p-10 sm:p-12 md:p-16 rounded-3xl bg-gradient-to-br from-honey/10 via-nectar/5 to-mint/10 border border-honey/20 backdrop-blur-sm shadow-2xl shadow-honey/10 overflow-hidden">
            {/* Decorative gradient orbs */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-honey/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-mint/20 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div data-testid="badge-cta-today" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-honey/10 border border-honey/20 mb-6">
                <Sparkles className="w-4 h-4 text-honey animate-pulse" />
                <span className="text-sm font-semibold text-honey">Start Building Today</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-5 sm:mb-6 break-words" data-testid="heading-cta">
                <span className="bg-gradient-to-r from-honey via-nectar to-mint bg-clip-text text-transparent">
                  Ready to Taste the Honey?
                </span>
              </h2>
              <p className="text-base sm:text-xl md:text-2xl text-muted-foreground mb-10 sm:mb-12 max-w-2xl mx-auto leading-relaxed" data-testid="text-cta-description">
                Join developers worldwide shipping production apps in minutes, not months
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-xs sm:max-w-none mx-auto">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto min-h-[56px] bg-honey text-charcoal-950 hover:bg-honey/90 font-bold text-lg px-10 shadow-lg shadow-honey/30 transition-all duration-300" 
                  data-testid="button-cta-start"
                  asChild
                >
                  <Link href="/builder">
                    <span className="flex items-center gap-2">
                      <Rocket className="w-5 h-5" />
                      Start Building Free
                    </span>
                  </Link>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="w-full sm:w-auto min-h-[56px] text-foreground border-border hover:bg-muted text-lg px-10 transition-all duration-300" 
                  data-testid="button-cta-pricing"
                  asChild
                >
                  <Link href="/pricing">View Pricing Plans</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Responsive */}
      <footer className="border-t border-border bg-gradient-to-b from-transparent to-honey/5 py-12 sm:py-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8 text-center sm:text-left mb-8">
            <div className="flex flex-col items-center sm:items-start gap-3">
              <BeehiveIcon size={64} className="flex-shrink-0" data-testid="icon-footer-logo" />
              <p className="text-muted-foreground text-sm font-medium">
                Where code gets sweeter by the hive
              </p>
            </div>
            <div className="flex gap-6 flex-wrap justify-center">
              <Link 
                href="/pricing" 
                className="text-foreground hover:text-honey text-base font-medium min-h-[44px] flex items-center transition-colors duration-200" 
                data-testid="footer-link-pricing"
              >
                Pricing
              </Link>
              <Link 
                href="/support" 
                className="text-foreground hover:text-honey text-base font-medium min-h-[44px] flex items-center transition-colors duration-200" 
                data-testid="footer-link-support"
              >
                Support
              </Link>
              <Link 
                href="/auth" 
                className="text-foreground hover:text-honey text-base font-medium min-h-[44px] flex items-center transition-colors duration-200" 
                data-testid="footer-link-login"
              >
                Login
              </Link>
            </div>
          </div>
          
          {/* Copyright */}
          <div className="text-center py-6 border-t border-border">
            <p className="text-sm text-muted-foreground" data-testid="text-copyright">
              © 2024 BeehiveAI. All rights reserved.
            </p>
          </div>
          
          {/* AI Disclaimer */}
          <div className="max-w-3xl mx-auto pt-6">
            <p className="text-xs text-muted-foreground text-center break-words whitespace-normal leading-relaxed" data-testid="text-disclaimer">
              AI-generated code requires human review and testing. Results may vary based on project complexity. 
              BeehiveAI is an AI-assisted development tool - not a replacement for skilled developers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
