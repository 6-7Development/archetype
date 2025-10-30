import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MobileNav } from "@/components/mobile-nav";
import { Sparkles, Zap, Shield, Gauge, Code, Rocket, Check, Terminal, Play, ArrowRight } from "lucide-react";
import { LogoEnhancedBadge, LemonAidTextLogo } from '@/components/final-logos';
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { MotionToggle } from "@/components/motion-toggle";
import { LeadCaptureForm } from "@/components/lead-capture-form";
import { DeploymentStatus } from "@/components/deployment-status";
import { taglines } from '@/lib/taglines';
import { BillboardBanner } from '@/components/billboard-banner';

const FloatingParticle = ({ delay = 0, duration = 20 }: { delay?: number; duration?: number }) => {
  const randomX = Math.random() * 100;
  const randomY = Math.random() * 100;
  
  return (
    <motion.div
      className="absolute w-3 h-3 rounded-full bg-primary/50 blur-[1px]"
      style={{ 
        left: `${randomX}%`, 
        top: `${randomY}%`,
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{
        x: [0, 100, -50, 150, 0],
        y: [0, -150, 100, -100, 0],
        opacity: [0, 0.8, 0.5, 0.8, 0],
        scale: [0.5, 1.2, 0.8, 1.2, 0.5],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
};

const AnimatedCounter = ({ end, duration = 2 }: { end: number; duration?: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = end / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [end, duration]);

  return <>{count.toLocaleString()}</>;
};

const RotatingText = () => {
  const phrases = [
    "Squeeze Fresh Code",
    "Make Life Sweet",
    "Turn Ideas Into Apps",
    "Ship Projects Faster", 
    "Build Without Coding",
    "Launch in Minutes",
    "Create Professional Apps",
    "Deploy Instantly"
  ];
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % phrases.length);
        setIsVisible(true);
      }, 500); // Half second fade out
      
    }, 3000); // Change every 3 seconds

    return () => clearInterval(interval);
  }, [phrases.length]);

  return (
    <motion.span 
      className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent inline-block"
      animate={{ 
        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        opacity: isVisible ? 1 : 0,
      }}
      transition={{ 
        backgroundPosition: { duration: 5, repeat: Infinity },
        opacity: { duration: 0.5 }
      }}
      style={{ backgroundSize: "200% 200%" }}
    >
      {phrases[currentIndex]}
    </motion.span>
  );
};

export default function Landing() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let rafId: number;
    let lastUpdate = 0;
    const throttleMs = 50; // Throttle to 20fps max for smooth performance

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdate < throttleMs) return;
      
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setMousePosition({ x: e.clientX, y: e.clientY });
        lastUpdate = now;
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Animated Background Gradient - Hidden for motion-sensitive users */}
      <motion.div
        className="absolute inset-0 opacity-40 z-0 motion-safe-only"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(6, 182, 212, 0.25), transparent 50%)`,
        }}
        aria-hidden="true"
      />

      {/* Floating Particles - Hidden for motion-sensitive users */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10 motion-safe-only" aria-hidden="true">
        {[...Array(30)].map((_, i) => (
          <FloatingParticle key={i} delay={i * 0.3} duration={10 + i * 1.5} />
        ))}
      </div>

      {/* Navigation - Simplified for Mobile */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="container mx-auto px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Logo - Simplified on mobile */}
            <Link href="/" data-testid="link-home" className="flex items-center gap-2 flex-shrink-0">
              <LemonAidTextLogo size="sm" />
            </Link>
            
            {/* Right Side - Clean */}
            <div className="flex items-center gap-1 sm:gap-2">
              <MobileNav
                links={[
                  { href: "/", label: "Home" },
                  { href: "/pricing", label: "Pricing" },
                  { href: "/auth", label: "Login" },
                  { href: "/builder", label: "Get Started" }
                ]}
                logo={
                  <LemonAidTextLogo size="sm" />
                }
              />
              <Button variant="outline" className="min-h-[44px] hidden md:inline-flex text-white border-slate-600 hover:bg-slate-800" data-testid="button-nav-login" asChild>
                <Link href="/auth">Login</Link>
              </Button>
              <Button className="min-h-[44px] hidden sm:inline-flex bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-slate-professional font-semibold" data-testid="button-nav-builder" asChild>
                <Link href="/builder">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Billboard Banner */}
      <div className="pt-20 pb-6 px-6 relative z-20">
        <div className="container mx-auto max-w-6xl">
          <BillboardBanner
            type="announcement"
            title="New Feature: Meta-SySop Auto-Healing!"
            description="Our AI now automatically fixes bugs and deploys updates - watch your platform heal itself in real-time"
            ctaText="See It In Action"
            ctaLink="/platform-healing"
            animated={true}
            dismissible={true}
          />
        </div>
      </div>

      {/* Hero Section */}
      <section className="pt-12 pb-20 px-6 relative z-20">
        <div className="container mx-auto max-w-6xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-4 h-4 text-primary" />
            </motion.div>
            <span className="text-sm text-primary font-medium">Powered by Claude Sonnet 4</span>
          </motion.div>
          
          <motion.h1 
            className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight break-words"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <RotatingText />
            <br />
            <motion.span 
              className="text-white break-words"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              With AI in Seconds
            </motion.span>
          </motion.h1>
          
          <motion.p 
            className="text-xl text-slate-400 mb-10 max-w-3xl mx-auto break-words whitespace-normal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {taglines.professional[0]} 
            No coding required—just fresh, squeezed code ready to deploy.
          </motion.p>

          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" variant="gradient" data-testid="button-hero-start" asChild>
                <Link href="/builder">
                  <Rocket className="w-5 h-5 mr-2" />
                  Start Building Free
                </Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(255, 183, 3, 0.5)",
                    "0 0 40px rgba(255, 183, 3, 0.8)",
                    "0 0 20px rgba(255, 183, 3, 0.5)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-secondary to-accent hover:from-secondary hover:to-accent text-white border-0 font-bold"
                  data-testid="button-hero-pricing" 
                  asChild
                >
                  <Link href="/pricing">
                    View Pricing
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Animated Stats */}
          <motion.div 
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mt-20 max-w-4xl mx-auto px-2"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
          >
            {[
              { value: "Sonnet 4", label: "Claude AI", testId: "stat-accuracy" },
              { value: "12-Step", label: "AI Workflow", testId: "stat-languages" },
              { value: "Full Stack", label: "Web Expertise", testId: "stat-availability" },
              { value: "2D/3D", label: "Game Support", testId: "stat-deployment" }
            ].map((stat, i) => (
              <motion.div 
                key={i} 
                className="text-center" 
                data-testid={stat.testId}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2 + i * 0.1 }}
                whileHover={{ scale: 1.1 }}
              >
                <motion.div 
                  className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent whitespace-nowrap"
                  animate={{ 
                    backgroundPosition: ["0%", "100%", "0%"],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  {stat.value}
                </motion.div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Lead Capture Section */}
          <motion.div
            className="mt-16 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 }}
          >
            <div className="max-w-2xl mx-auto text-center mb-6">
              <motion.h3 
                className="text-2xl sm:text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent break-words leading-snug"
                animate={{ 
                  backgroundPosition: ["0%", "100%", "0%"],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                Start Building in 60 Seconds
              </motion.h3>
              <p className="text-slate-400 break-words">Join thousands of developers squeezing fresh code with AI</p>
            </div>
            <LeadCaptureForm source="landing_page_hero" />
          </motion.div>
        </div>
      </section>

      {/* Transparency Banner - Cost Preview Feature */}
      <section className="py-16 px-6 relative bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-y border-primary/20">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm mb-6"
              animate={{ 
                boxShadow: [
                  "0 0 20px rgba(255, 220, 50, 0.3)",
                  "0 0 40px rgba(255, 220, 50, 0.5)",
                  "0 0 20px rgba(255, 220, 50, 0.3)",
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">100% Transparent Pricing</span>
            </motion.div>

            <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white break-words leading-snug">
              Know Exactly What You'll Pay{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent break-words">
                Before Building
              </span>
            </h2>

            <p className="text-xl text-slate-300 mb-10 max-w-3xl mx-auto break-words whitespace-normal">
              No hidden fees. No surprises. See your project's estimated tokens and cost in real-time before generating any code.
            </p>

            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="p-6 bg-slate-900/50 border-slate-800 hover-elevate overflow-visible h-full" data-testid="feature-cost-preview">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary mb-4 mx-auto">
                    <Gauge className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white break-words">Real-Time Cost Preview</h3>
                  <p className="text-slate-400 text-sm break-words whitespace-normal">
                    AI analyzes your request and shows exact token estimate and cost before you confirm
                  </p>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                whileHover={{ y: -5 }}
              >
                <Card className="p-6 bg-slate-900/50 border-slate-800 hover-elevate overflow-visible h-full" data-testid="feature-complexity-detection">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary mb-4 mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white break-words">Smart Complexity Detection</h3>
                  <p className="text-slate-400 text-sm break-words whitespace-normal">
                    Automatic analysis determines if your project is simple, medium, complex, or enterprise-scale
                  </p>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                whileHover={{ y: -5 }}
              >
                <Card className="p-6 bg-slate-900/50 border-slate-800 hover-elevate overflow-visible h-full" data-testid="feature-token-tracking">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary mb-4 mx-auto">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white break-words">Usage Dashboard</h3>
                  <p className="text-slate-400 text-sm break-words whitespace-normal">
                    Track your token usage in real-time with detailed breakdowns and overage alerts
                  </p>
                </Card>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="mt-8"
            >
              <p className="text-sm text-slate-400 max-w-2xl mx-auto break-words whitespace-normal">
                <strong className="text-primary">Fair pricing model:</strong> $1.50 per 1,000 overage tokens ensures you only pay for what you use beyond your plan's included tokens.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section className="py-20 px-6 relative">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 break-words leading-snug">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent break-words">
                See AI in Action
              </span>
            </h2>
            <p className="text-xl text-slate-400 break-words">Watch LemonAid squeeze fresh, production-ready code</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <Card className="p-8 bg-gradient-to-br from-slate-900/80 to-slate-950/80 border-primary/20 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Terminal className="w-6 h-6 text-primary" />
                </motion.div>
                <h3 className="text-xl font-bold text-white break-words">Command: "Build a landing page for a SaaS product"</h3>
              </div>
              <div className="bg-slate-950 rounded-lg p-6 border border-primary/20">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="font-mono text-sm text-primary space-y-2"
                >
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    → Analyzing requirements...
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 }}
                  >
                    → Generating React components...
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.2 }}
                  >
                    → Applying responsive design...
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.5 }}
                    className="text-green-400 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Complete! 3 files generated in 2.4s
                  </motion.div>
                </motion.div>
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
                className="mt-6 flex justify-center"
              >
                <Button variant="gradient" asChild>
                  <Link href="/builder">
                    <Play className="w-4 h-4 mr-2" />
                    Try It Yourself
                  </Link>
                </Button>
              </motion.div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-slate-950/50 relative">
        <div className="container mx-auto max-w-6xl">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 break-words leading-snug">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent break-words">
                Enterprise-Grade AI Platform
              </span>
            </h2>
            <p className="text-xl text-slate-400 break-words">Making life sweet for developers and enterprises alike</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Zap className="w-6 h-6" />,
                title: "12-Step Enhanced Workflow",
                desc: "Deep understanding → intelligent build → rigorous testing → iterative refinement for high quality",
                testId: "feature-workflow"
              },
              {
                icon: <Code className="w-6 h-6" />,
                title: "Full Stack Web Expertise",
                desc: "React, Vue, REST APIs, databases, auth, real-time, PWA, performance optimization",
                testId: "feature-fullstack"
              },
              {
                icon: <Sparkles className="w-6 h-6" />,
                title: "Professional Game Development",
                desc: "Phaser 3, Three.js, Babylon.js, physics engines, audio, 2D/3D games in one command",
                testId: "feature-gamedev"
              },
              {
                icon: <Shield className="w-6 h-6" />,
                title: "Self-Testing & Validation",
                desc: "Syntax, logic, integration, security audits - fixes issues automatically before delivery",
                testId: "feature-testing"
              },
              {
                icon: <Gauge className="w-6 h-6" />,
                title: "Learning & Adaptation",
                desc: "Recognizes new tech, infers from context, applies patterns, remembers for future",
                testId: "feature-learning"
              },
              {
                icon: <Rocket className="w-6 h-6" />,
                title: "Instant Deployment",
                desc: "One-click deployment to custom subdomains with live preview and automatic updates",
                testId: "feature-deployment"
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="p-6 bg-slate-900/50 border-slate-800 transition-all hover-elevate overflow-visible h-full" data-testid={feature.testId}>
                  <motion.div 
                    className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary mb-4"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                  >
                    {feature.icon}
                  </motion.div>
                  <h3 className="text-xl font-semibold mb-2 text-white break-words">{feature.title}</h3>
                  <p className="text-slate-400 break-words whitespace-normal">{feature.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <Card className="p-12 bg-gradient-to-br from-primary/20 to-secondary/20 border-primary/30 text-center overflow-hidden relative">
              {/* Animated gradient overlay */}
              <motion.div
                className="absolute inset-0 opacity-30"
                animate={{
                  background: [
                    "radial-gradient(circle at 20% 50%, rgba(255, 220, 50, 0.3), transparent 50%)",
                    "radial-gradient(circle at 80% 50%, rgba(103, 184, 104, 0.3), transparent 50%)",
                    "radial-gradient(circle at 20% 50%, rgba(255, 220, 50, 0.3), transparent 50%)",
                  ],
                }}
                transition={{ duration: 5, repeat: Infinity }}
              />
              
              <div className="relative z-10">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white break-words leading-snug">
                  Ready to Squeeze Fresh Code?
                </h2>
                <p className="text-xl text-slate-300 mb-8 break-words whitespace-normal">
                  When code throws you lemons, LemonAid makes it sweet
                </p>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="lg" variant="gradient" data-testid="button-cta" asChild>
                    <Link href="/builder">
                      <Rocket className="w-5 h-5 mr-2" />
                      Start Building Free
                    </Link>
                  </Button>
                </motion.div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center text-slate-500">
            <motion.div 
              className="flex items-center justify-center gap-3 mb-4"
              whileHover={{ scale: 1.05 }}
            >
              <LemonAidTextLogo size="default" />
            </motion.div>
            <p className="text-sm mb-4 break-words">© 2025 LemonAid. When code throws you lemons, you get LemonAid.</p>
            <DeploymentStatus />
          </div>
        </div>
      </footer>
    </div>
  );
}