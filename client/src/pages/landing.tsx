import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sparkles, Zap, Shield, Code, Rocket, Check, Play, ArrowRight, Hexagon } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-charcoal-950 relative overflow-hidden">
      {/* Subtle honeycomb pattern background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23F7B500' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-honey/10 bg-charcoal-950/90 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" data-testid="link-home" className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Hexagon className="w-8 h-8 text-honey fill-honey/20" />
                <span className="text-2xl font-bold text-white">BeehiveAI</span>
              </div>
            </Link>
            
            <div className="flex items-center gap-3">
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
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative z-10">
        <div className="container mx-auto max-w-6xl text-center">
          {/* Powered by Badge */}
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-honey/30 bg-honey/10 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-honey" />
            <span className="text-sm text-honey font-medium">Powered by Claude Sonnet 4</span>
          </div>
          
          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-honey via-nectar to-mint bg-clip-text text-transparent">
              Build Full-Stack Apps
            </span>
            <br />
            <span className="text-white">With AI in Seconds</span>
          </h1>
          
          <p className="text-xl text-slate-400 mb-10 max-w-3xl mx-auto">
            Like a hive of expert developers working in perfect harmony. Zero coding required—just pure honey-sweet results.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            <Button 
              size="lg" 
              className="bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold text-base px-8" 
              data-testid="button-hero-start" 
              asChild
            >
              <Link href="/builder">
                <Zap className="w-5 h-5 mr-2" />
                Start Building Free
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-white border-white/20 hover:bg-white/5" 
              data-testid="button-hero-pricing" 
              asChild
            >
              <Link href="/pricing">
                View Pricing
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>

          {/* Feature Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { value: "Sonnet 4", label: "Claude AI" },
              { value: "12-Step", label: "AI Workflow" },
              { value: "Full Stack", label: "Web Expertise" },
              { value: "2D/3D", label: "Game Support" }
            ].map((stat, i) => (
              <div key={i} className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="text-2xl font-bold text-honey mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Screenshots Section */}
      <section className="py-20 px-6 relative">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-center mb-12 text-white">
            See the Platform in Action
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Screenshot 1: AI Chat */}
            <Card className="p-6 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate">
              <div className="aspect-video bg-slate-950/50 rounded-lg border border-slate-700/50 flex items-center justify-center mb-4">
                <div className="text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 text-honey" />
                  <p className="text-sm text-slate-300 font-medium">AI Chat Interface</p>
                  <p className="text-xs text-slate-500 mt-1">Real-time code generation</p>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Chat with the Hive</h3>
              <p className="text-sm text-slate-400">
                Tell the swarm what you need—watch specialized AI workers build your app with hive-mind precision
              </p>
            </Card>

            {/* Screenshot 2: Live Preview */}
            <Card className="p-6 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate">
              <div className="aspect-video bg-slate-950/50 rounded-lg border border-slate-700/50 flex items-center justify-center mb-4">
                <div className="text-center">
                  <Play className="w-12 h-12 mx-auto mb-3 text-mint" />
                  <p className="text-sm text-slate-300 font-medium">Live Preview</p>
                  <p className="text-xs text-slate-500 mt-1">Instant visual feedback</p>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Watch the Hive Work</h3>
              <p className="text-sm text-slate-400">
                See your app crystallize like honey as our worker bees code in real-time
              </p>
            </Card>

            {/* Screenshot 3: Code Editor */}
            <Card className="p-6 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate">
              <div className="aspect-video bg-slate-950/50 rounded-lg border border-slate-700/50 flex items-center justify-center mb-4">
                <div className="text-center">
                  <Code className="w-12 h-12 mx-auto mb-3 text-honey" />
                  <p className="text-sm text-slate-300 font-medium">Monaco Editor</p>
                  <p className="text-xs text-slate-500 mt-1">Full IDE in browser</p>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Your Personal Honeycomb</h3>
              <p className="text-sm text-slate-400">
                Every file perfectly organized in hexagonal precision—full IDE power at your fingertips
              </p>
            </Card>

            {/* Screenshot 4: Deployment */}
            <Card className="p-6 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate">
              <div className="aspect-video bg-slate-950/50 rounded-lg border border-slate-700/50 flex items-center justify-center mb-4">
                <div className="text-center">
                  <Rocket className="w-12 h-12 mx-auto mb-3 text-mint" />
                  <p className="text-sm text-slate-300 font-medium">One-Click Deploy</p>
                  <p className="text-xs text-slate-500 mt-1">Production hosting</p>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Harvest Your Creation</h3>
              <p className="text-sm text-slate-400">
                One-click deploy to production—take your sweet success live with custom domains and SSL
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-20 px-6 relative">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-honey to-mint bg-clip-text text-transparent">
                Why Choose BeehiveAI
              </span>
            </h2>
            <p className="text-xl text-slate-400">Swarm intelligence for modern development</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Speed */}
            <Card className="p-8 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate h-full">
              <div className="w-14 h-14 rounded-xl bg-honey/20 flex items-center justify-center text-honey mb-6">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Bee-Line to Production</h3>
              <p className="text-slate-400 leading-relaxed">
                Our swarm takes the most efficient path. 12-step workflow delivers production-ready code in minutes—tested and deployed.
              </p>
            </Card>

            {/* Quality */}
            <Card className="p-8 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate h-full">
              <div className="w-14 h-14 rounded-xl bg-mint/20 flex items-center justify-center text-mint mb-6">
                <Shield className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Queen Bee Quality</h3>
              <p className="text-slate-400 leading-relaxed">
                Every line inspected by our royal guard—self-testing, validation, and security audits ensure golden-standard code
              </p>
            </Card>

            {/* Swarm */}
            <Card className="p-8 bg-slate-900/30 border-slate-700/50 backdrop-blur-sm hover-elevate h-full">
              <div className="w-14 h-14 rounded-xl bg-honey/20 flex items-center justify-center text-honey mb-6">
                <Hexagon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Hive Mind Power</h3>
              <p className="text-slate-400 leading-relaxed">
                Specialized AI workers buzzing in perfect sync—planning, building, testing, deploying. Ship faster with true collaboration.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 relative">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="p-12 rounded-2xl bg-gradient-to-br from-honey/10 to-mint/10 border border-honey/20 backdrop-blur-sm">
            <h2 className="text-4xl font-bold mb-4 text-white">
              Ready to Taste the Honey?
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Join developers worldwide shipping production apps in minutes, not months
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold text-base px-8" 
                asChild
              >
                <Link href="/builder">
                  <Rocket className="w-5 h-5 mr-2" />
                  Start Building Free
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-white border-white/20 hover:bg-white/5" 
                asChild
              >
                <Link href="/pricing">View Pricing Plans</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Hexagon className="w-6 h-6 text-honey fill-honey/20" />
              <span className="text-white font-semibold">BeehiveAI</span>
            </div>
            <p className="text-slate-500 text-sm">
              © 2024 BeehiveAI. Where code gets sweeter by the hive.
            </p>
            <div className="flex gap-4">
              <Link href="/pricing" className="text-slate-400 hover:text-white text-sm">
                Pricing
              </Link>
              <Link href="/support" className="text-slate-400 hover:text-white text-sm">
                Support
              </Link>
              <Link href="/auth" className="text-slate-400 hover:text-white text-sm">
                Login
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
