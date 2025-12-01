/**
 * COMPREHENSIVE SITE CONFIGURATION
 * ================================
 * Edit this ONE file to customize the ENTIRE website.
 * All text, colors, layouts, features, and content are defined here.
 * 
 * NO HARDCODED VALUES - Everything is dynamic and easy to edit.
 */

import { 
  Sparkles, Zap, Shield, Code, Rocket, Play, Hexagon,
  Users, Globe, Lock, Clock, Database, Cpu, Cloud, 
  Terminal, FileCode, GitBranch, MessageSquare,
  type LucideIcon
} from "lucide-react";

// ============================================================================
// BRAND CONFIGURATION
// ============================================================================
export const BRAND = {
  name: "BeeHive",
  tagline: "Collaborative Hive Intelligence for Code",
  subtitle: "Collective",
  description: "AI-powered platform for rapid web development",
  
  // Logo configuration
  logo: {
    showText: true,
    sizes: {
      sm: 48,
      md: 64,
      lg: 96,
      xl: 128,
    },
  },
  
  // Social links
  social: {
    github: "https://github.com/6-7Development/archetype",
    twitter: "https://twitter.com/beehiveai",
    discord: "https://discord.gg/beehive",
    docs: "https://docs.beehive.ai",
  },
  
  // Legal
  legal: {
    company: "BeeHive AI, Inc.",
    year: new Date().getFullYear(),
    copyright: "All rights reserved.",
  },
} as const;

// ============================================================================
// THEME & COLORS
// ============================================================================
export const THEME = {
  // Primary brand colors (used throughout the site)
  colors: {
    honey: {
      value: "#F7B500",
      hsl: "40 97% 50%",
      className: "honey",
    },
    nectar: {
      value: "#FFD34D",
      hsl: "48 100% 65%",
      className: "nectar",
    },
    mint: {
      value: "#00D4B3",
      hsl: "171 100% 42%",
      className: "mint",
    },
    charcoal: {
      value: "#101113",
      hsl: "216 9% 7%",
      className: "charcoal",
    },
    cream: {
      value: "#FFF8E6",
      hsl: "47 100% 95%",
      className: "cream",
    },
  },
  
  // Gradient presets
  gradients: {
    primary: "from-honey via-nectar to-mint",
    honey: "from-honey/20 to-nectar/20",
    mint: "from-mint/20 to-mint/30",
    hero: "from-honey/5 via-nectar/5 to-mint/5",
    cta: "from-honey/10 via-nectar/5 to-mint/10",
  },
  
  // Shadow presets
  shadows: {
    honey: "shadow-lg shadow-honey/20",
    mint: "shadow-lg shadow-mint/20",
    cta: "shadow-2xl shadow-honey/10",
  },
} as const;

// ============================================================================
// LAYOUT CONFIGURATION
// ============================================================================
export const LAYOUT = {
  // Container max widths
  container: {
    sm: "max-w-4xl",
    md: "max-w-5xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
  },
  
  // Section spacing
  section: {
    padding: {
      sm: "py-12 sm:py-16 px-4 sm:px-6",
      md: "py-16 sm:py-20 md:py-24 px-4 sm:px-6",
      lg: "py-20 sm:py-24 md:py-32 px-4 sm:px-6",
    },
  },
  
  // Grid configurations
  grid: {
    features: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    stats: "grid-cols-2 sm:grid-cols-4",
    screenshots: "grid-cols-1 md:grid-cols-2",
    pricing: "grid-cols-1 md:grid-cols-3",
  },
  
  // Gap sizes
  gap: {
    sm: "gap-3 sm:gap-4",
    md: "gap-4 sm:gap-6",
    lg: "gap-6 sm:gap-8",
  },
  
  // Navigation
  nav: {
    height: {
      mobile: "min-h-[60px]",
      tablet: "sm:min-h-[70px]",
      desktop: "md:min-h-[140px]",
    },
    blur: "backdrop-blur-xl",
  },
} as const;

// ============================================================================
// HERO SECTION CONTENT
// ============================================================================
export const HERO = {
  badge: {
    text: "Powered by Gemini 2.5 Flash",
    icon: Sparkles,
    testId: "badge-hero-stack",
  },
  
  headline: {
    text: "Build Full-Stack Apps With AI in Minutes",
    testId: "heading-hero",
  },
  
  subheadline: {
    text: "Like a hive of expert developers working in perfect harmony. Zero coding required—just pure honey-sweet results.",
    testId: "text-hero-subtitle",
  },
  
  cta: {
    primary: {
      text: "Start Building Free",
      href: "/builder",
      icon: Zap,
      testId: "button-hero-start",
    },
    secondary: {
      text: "View Pricing",
      href: "/pricing",
      testId: "button-hero-pricing",
    },
  },
  
  stats: [
    { 
      value: "Gemini 2.5", 
      label: "AI Model", 
      icon: Sparkles, 
      testId: "card-feature-gemini" 
    },
    { 
      value: "7-Phase", 
      label: "AI Workflow", 
      icon: Zap, 
      testId: "card-feature-7phase" 
    },
    { 
      value: "Full Stack", 
      label: "Web Expertise", 
      icon: Code, 
      testId: "card-feature-fullstack" 
    },
    { 
      value: "2D/3D", 
      label: "Game Support", 
      icon: Rocket, 
      testId: "card-feature-games" 
    },
  ],
} as const;

// ============================================================================
// PLATFORM SCREENSHOTS SECTION
// ============================================================================
export const PLATFORM_SECTION = {
  title: "See the Platform in Action",
  subtitle: "Everything you need to build, test, and deploy production-ready applications",
  testId: "heading-platform",
  
  screenshots: [
    {
      title: "Chat with the Hive",
      description: "Tell the swarm what you need—watch specialized AI workers build your app with hive-mind precision",
      icon: Sparkles,
      iconLabel: "AI Chat Interface",
      iconSubLabel: "Real-time code generation",
      gradient: "honey",
      testId: "card-screenshot-chat",
    },
    {
      title: "Watch the Hive Work",
      description: "See your app crystallize like honey as our worker bees code in real-time",
      icon: Play,
      iconLabel: "Live Preview",
      iconSubLabel: "Instant visual feedback",
      gradient: "mint",
      testId: "card-screenshot-preview",
    },
    {
      title: "Your Personal Honeycomb",
      description: "Every file perfectly organized in hexagonal precision—full IDE power at your fingertips",
      icon: Code,
      iconLabel: "Monaco Editor",
      iconSubLabel: "Full IDE in browser",
      gradient: "honey",
      testId: "card-screenshot-editor",
    },
    {
      title: "Harvest Your Creation",
      description: "Deploy to production with Cloudflare Pages—custom domains and SSL included",
      icon: Rocket,
      iconLabel: "Production Deployment",
      iconSubLabel: "Production hosting",
      gradient: "mint",
      testId: "card-screenshot-deployment",
    },
  ],
} as const;

// ============================================================================
// FEATURES SECTION
// ============================================================================
export const FEATURES_SECTION = {
  title: "Why Choose BeeHive",
  subtitle: "Swarm intelligence for modern development",
  testId: "heading-features",
  
  features: [
    {
      title: "Bee-Line to Production",
      description: "Our swarm takes the most efficient path. 7-phase workflow delivers production-ready code in minutes—tested and deployed.",
      icon: Zap,
      color: "honey",
      testId: "card-feature-speed",
    },
    {
      title: "Queen Bee Quality",
      description: "Every line inspected by our royal guard—self-testing, validation, and security audits ensure golden-standard code",
      icon: Shield,
      color: "mint",
      testId: "card-feature-quality",
    },
    {
      title: "Hive Mind Power",
      description: "Specialized AI workers buzzing in perfect sync—planning, building, testing, deploying. Ship faster with true collaboration.",
      icon: Hexagon,
      color: "honey",
      testId: "card-feature-swarm",
    },
  ],
} as const;

// ============================================================================
// CTA SECTION
// ============================================================================
export const CTA_SECTION = {
  badge: {
    text: "Start Building Today",
    icon: Sparkles,
    testId: "badge-cta-today",
  },
  
  headline: {
    text: "Ready to Taste the Honey?",
    testId: "heading-cta",
  },
  
  subheadline: {
    text: "Join developers worldwide shipping production apps in minutes, not months",
    testId: "text-cta-description",
  },
  
  cta: {
    primary: {
      text: "Start Building Free",
      href: "/builder",
      icon: Rocket,
      testId: "button-cta-start",
    },
    secondary: {
      text: "View Pricing Plans",
      href: "/pricing",
      testId: "button-cta-pricing",
    },
  },
} as const;

// ============================================================================
// FOOTER CONFIGURATION
// ============================================================================
export const FOOTER = {
  tagline: "Where code gets sweeter by the hive",
  
  links: [
    { label: "Pricing", href: "/pricing", testId: "footer-link-pricing" },
    { label: "Support", href: "/support", testId: "footer-link-support" },
    { label: "Privacy", href: "/privacy", testId: "footer-link-privacy" },
    { label: "Terms", href: "/terms", testId: "footer-link-terms" },
    { label: "Blog", href: "/blog", testId: "footer-link-blog" },
  ],
  
  copyright: `© ${new Date().getFullYear()} BeeHive. All rights reserved.`,
  testId: "text-footer-copyright",
} as const;

// ============================================================================
// NAVIGATION CONFIGURATION
// ============================================================================
export const NAVIGATION = {
  // Top nav links (desktop)
  desktop: [
    { label: "View Pricing", href: "/pricing", testId: "button-nav-pricing" },
    { label: "Login", href: "/auth", testId: "button-nav-login" },
  ],
  
  // CTA button
  cta: {
    label: "Get Started",
    href: "/builder",
    testId: "button-nav-get-started",
  },
  
  // Mobile menu items
  mobile: [
    { label: "Pricing", href: "/pricing", icon: "DollarSign", testId: "menu-link-pricing" },
    { label: "Login", href: "/auth", icon: "LogIn", testId: "menu-link-login" },
    { label: "Get Started", href: "/builder", icon: "Rocket", testId: "menu-link-builder", primary: true },
  ],
} as const;

// ============================================================================
// PRICING CONFIGURATION
// ============================================================================
export const PRICING = {
  title: "Simple, Transparent Pricing",
  subtitle: "Start free. Scale as you grow.",
  
  plans: [
    {
      name: "Free",
      price: "$0",
      period: "/month",
      description: "Perfect for trying out BeeHive",
      features: [
        "5 projects",
        "Basic AI assistance",
        "Community support",
        "1GB storage",
      ],
      cta: {
        text: "Get Started",
        href: "/auth",
        variant: "outline" as const,
      },
      highlighted: false,
      testId: "pricing-free",
    },
    {
      name: "Pro",
      price: "$19",
      period: "/month",
      description: "For serious developers",
      features: [
        "Unlimited projects",
        "Advanced AI (Gemini 2.5 Pro)",
        "Priority support",
        "10GB storage",
        "Custom domains",
        "Team collaboration",
      ],
      cta: {
        text: "Start Free Trial",
        href: "/auth",
        variant: "default" as const,
      },
      highlighted: true,
      badge: "Most Popular",
      testId: "pricing-pro",
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large teams",
      features: [
        "Everything in Pro",
        "Dedicated support",
        "SLA guarantee",
        "Unlimited storage",
        "SSO/SAML",
        "Custom integrations",
      ],
      cta: {
        text: "Contact Sales",
        href: "/support",
        variant: "outline" as const,
      },
      highlighted: false,
      testId: "pricing-enterprise",
    },
  ],
} as const;

// ============================================================================
// AI AGENT CONFIGURATION
// ============================================================================
export const AGENT = {
  name: "Scout",
  description: "Your autonomous AI coding companion",
  
  // Workflow phases
  workflow: {
    phases: [
      { name: "ASSESS", description: "Analyze requirements" },
      { name: "PLAN", description: "Create execution strategy" },
      { name: "EXECUTE", description: "Write code" },
      { name: "TEST", description: "Validate functionality" },
      { name: "VERIFY", description: "Quality check" },
      { name: "CONFIRM", description: "User approval" },
      { name: "COMMIT", description: "Save changes" },
    ],
  },
  
  // AI Models
  models: {
    standard: {
      name: "Gemini 2.5 Flash",
      cost: "$0.075 / 1M tokens",
      context: "1M tokens",
    },
    advanced: {
      name: "Gemini 2.5 Pro",
      cost: "$1.50 / 1M tokens",
      context: "2M tokens",
    },
  },
  
  // Status messages
  messages: {
    thinking: "Scout is thinking...",
    working: "Scout is working...",
    complete: "Task completed",
    error: "Something went wrong",
    idle: "Ready to help",
  },
} as const;

// ============================================================================
// COMPONENT VARIANTS
// ============================================================================
export const COMPONENTS = {
  // Button variants
  button: {
    primary: "bg-honey text-charcoal-950 hover:bg-honey/90 font-semibold",
    secondary: "bg-mint text-charcoal-950 hover:bg-mint/90 font-semibold",
    outline: "border-border text-foreground hover:bg-muted",
    ghost: "text-foreground/80 hover:text-foreground hover:bg-muted",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  },
  
  // Card variants
  card: {
    default: "bg-card border-border hover-elevate transition-all duration-300 shadow-sm hover:shadow-lg",
    feature: "bg-card border-border hover-elevate h-full transition-all duration-300 shadow-sm hover:shadow-lg",
    screenshot: "bg-card border-border hover-elevate transition-all duration-300 shadow-sm hover:shadow-xl",
  },
  
  // Badge variants
  badge: {
    default: "bg-honey/10 border-honey/20 text-honey",
    mint: "bg-mint/10 border-mint/20 text-mint",
    gradient: "bg-gradient-to-r from-honey/5 via-nectar/5 to-mint/5 border-honey/20",
  },
  
  // Icon containers
  iconContainer: {
    honey: "bg-gradient-to-br from-honey/20 to-nectar/20 text-honey border-honey/20",
    mint: "bg-gradient-to-br from-mint/20 to-mint/30 text-mint border-mint/20",
  },
} as const;

// ============================================================================
// ANIMATION CONFIGURATION
// ============================================================================
export const ANIMATIONS = {
  // Transition durations
  duration: {
    fast: "duration-150",
    normal: "duration-300",
    slow: "duration-500",
  },
  
  // Hover effects
  hover: {
    scale: "group-hover:scale-110",
    lift: "hover-elevate",
    glow: "hover:shadow-lg",
  },
  
  // Entrance animations
  entrance: {
    fadeUp: "animate-fade-up",
    slideIn: "animate-slide-in",
    zoomIn: "animate-zoom-in",
  },
} as const;

// ============================================================================
// SEO CONFIGURATION
// ============================================================================
export const SEO = {
  defaultTitle: "BeeHive - AI-Powered Web Development Platform",
  titleTemplate: "%s | BeeHive",
  
  defaultDescription: "Build full-stack apps with AI in minutes. BeeHive combines swarm intelligence with cutting-edge AI to help you ship production-ready applications faster than ever.",
  
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "BeeHive",
  },
  
  twitter: {
    handle: "@beehiveai",
    cardType: "summary_large_image",
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get gradient classes based on color name
 */
export function getGradientClasses(color: "honey" | "mint"): string {
  return color === "honey" 
    ? "from-honey/5 to-nectar/5" 
    : "from-mint/5 to-mint/10";
}

/**
 * Get icon container classes based on color
 */
export function getIconContainerClasses(color: "honey" | "mint"): string {
  return COMPONENTS.iconContainer[color];
}

/**
 * Get text color class based on color name
 */
export function getTextColorClass(color: "honey" | "mint"): string {
  return color === "honey" ? "text-honey" : "text-mint";
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type BrandConfig = typeof BRAND;
export type ThemeConfig = typeof THEME;
export type LayoutConfig = typeof LAYOUT;
export type HeroConfig = typeof HERO;
export type FeaturesConfig = typeof FEATURES_SECTION;
export type PricingConfig = typeof PRICING;
export type AgentConfig = typeof AGENT;
export type SeoConfig = typeof SEO;
