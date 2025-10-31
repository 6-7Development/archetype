import { useState, useEffect } from 'react';
import { X, Sparkles, Megaphone, Gift, Rocket, Zap, Bot, Code, Webhook, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';

interface PlatformUpdate {
  icon: string;
  title: string;
  description: string;
  cta?: string;
  link?: string;
  requiresAuth?: boolean; // If true, show login prompt for unauthenticated users
  type: 'announcement' | 'update' | 'feature' | 'event' | 'maintenance';
  date: string; // ISO date string
}

// Seasonal theme detection
function getSeasonalTheme() {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const day = now.getDate();

  // Halloween (October 1-31)
  if (month === 9) {
    return {
      name: 'halloween',
      colors: {
        bg: 'from-orange-900/20 via-purple-900/20 to-black/30',
        border: 'border-orange-500/30',
        accent: 'text-orange-400',
        glow: 'shadow-orange-500/20'
      },
      decorations: ['🎃', '👻', '🦇', '🕷️', '🕸️']
    };
  }
  
  // Christmas (December 1-26)
  if (month === 11 && day <= 26) {
    return {
      name: 'christmas',
      colors: {
        bg: 'from-red-900/20 via-green-900/20 to-blue-900/30',
        border: 'border-red-500/30',
        accent: 'text-red-400',
        glow: 'shadow-red-500/20'
      },
      decorations: ['🎄', '⛄', '🎅', '🎁', '❄️']
    };
  }

  // New Year (December 27 - January 7)
  if ((month === 11 && day > 26) || (month === 0 && day <= 7)) {
    return {
      name: 'newyear',
      colors: {
        bg: 'from-yellow-900/20 via-purple-900/20 to-pink-900/30',
        border: 'border-yellow-500/30',
        accent: 'text-yellow-400',
        glow: 'shadow-yellow-500/20'
      },
      decorations: ['🎆', '🎊', '🥳', '✨', '🎉']
    };
  }

  // Spring (March-May)
  if (month >= 2 && month <= 4) {
    return {
      name: 'spring',
      colors: {
        bg: 'from-pink-900/20 via-green-900/20 to-blue-900/30',
        border: 'border-pink-500/30',
        accent: 'text-pink-400',
        glow: 'shadow-pink-500/20'
      },
      decorations: ['🌸', '🌺', '🦋', '🌷', '🐝']
    };
  }

  // Summer (June-August)
  if (month >= 5 && month <= 7) {
    return {
      name: 'summer',
      colors: {
        bg: 'from-yellow-900/20 via-orange-900/20 to-blue-900/30',
        border: 'border-yellow-500/30',
        accent: 'text-yellow-400',
        glow: 'shadow-yellow-500/20'
      },
      decorations: ['☀️', '🌊', '🏖️', '🍉', '🌴']
    };
  }

  // Fall (September-November)
  if (month >= 8 && month <= 10) {
    return {
      name: 'fall',
      colors: {
        bg: 'from-orange-900/20 via-red-900/20 to-brown-900/30',
        border: 'border-orange-500/30',
        accent: 'text-orange-400',
        glow: 'shadow-orange-500/20'
      },
      decorations: ['🍂', '🍁', '🌰', '🦃', '🎃']
    };
  }

  // Default (Lomu citrus theme)
  return {
    name: 'default',
    colors: {
      bg: 'from-primary/10 via-secondary/10 to-accent/10',
      border: 'border-primary/30',
      accent: 'text-primary',
      glow: 'shadow-primary/20'
    },
    decorations: ['🍋', '✨', '💫', '⚡', '🌟']
  };
}

// Platform updates - Current platform announcements
const PLATFORM_UPDATES: PlatformUpdate[] = [
  {
    icon: "🤖",
    title: "LomuAI Auto-Healing Now Live",
    description: "Platform now automatically fixes bugs and deploys updates. Autonomous healing agent monitors and repairs issues 24/7.",
    cta: "View Platform Health",
    link: "/platform-healing",
    requiresAuth: true,
    type: "announcement",
    date: "2025-10-29"
  },
  {
    icon: "⚡",
    title: "AI-Powered Code Generation",
    description: "Build full-stack applications with natural language commands. Powered by Claude Sonnet 4 for superior code quality.",
    cta: "Start Building",
    link: "/builder",
    requiresAuth: false,
    type: "feature",
    date: "2025-10-30"
  },
  {
    icon: "📊",
    title: "Real-Time Collaboration",
    description: "Team workspaces with role-based access control. Build together with live preview and instant synchronization.",
    cta: "Create Team",
    link: "/team",
    requiresAuth: true,
    type: "update",
    date: "2025-10-30"
  },
  {
    icon: "🚀",
    title: "One-Click Deployments",
    description: "Deploy to Railway or Render with automatic SSL, health checks, and rollback support built-in.",
    cta: "Deploy Now",
    link: "/publishing",
    requiresAuth: false,
    type: "feature",
    date: "2025-10-28"
  },
];

interface BillboardBannerProps {
  // Optional props to override rotating messages
  title?: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  type?: 'announcement' | 'update' | 'feature' | 'event' | 'maintenance';
  onDismiss?: () => void;
  dismissible?: boolean;
  animated?: boolean;
  rotating?: boolean; // Enable rotation through PLATFORM_UPDATES
}

export function BillboardBanner({
  title,
  description,
  ctaText,
  ctaLink,
  type,
  onDismiss,
  dismissible = true,
  animated = true,
  rotating = false
}: BillboardBannerProps) {
  const [, setLocation] = useLocation();
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number }>>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [glowIntensity, setGlowIntensity] = useState(1);
  const [currentUpdateIndex, setCurrentUpdateIndex] = useState(0);
  const [fadeState, setFadeState] = useState<'visible' | 'fading'>('visible');
  const [gradientPosition, setGradientPosition] = useState(0);
  
  // Get seasonal theme (must be called within component, not at module level)
  const seasonalTheme = getSeasonalTheme();

  // Check auth status
  const { data: authData } = useQuery<{ user: { id: string; email: string } | null }>({
    queryKey: ['/api/auth/me'],
    enabled: rotating, // Only check auth if rotating (to avoid unnecessary requests on static banners)
  });
  
  const isAuthenticated = !!authData?.user;

  // Current update (either from rotation or props)
  const currentUpdate = rotating ? PLATFORM_UPDATES[currentUpdateIndex] : null;
  const displayTitle = currentUpdate?.title || title || "";
  const displayDescription = currentUpdate?.description || description || "";
  const displayCtaText = currentUpdate?.cta || ctaText;
  const displayCtaLink = currentUpdate?.link || ctaLink;
  const requiresAuth = currentUpdate?.requiresAuth ?? false;
  const displayType = currentUpdate?.type || type || 'announcement';

  // Rotate through updates every 10 seconds (slower for readability)
  useEffect(() => {
    if (!rotating) return;

    const interval = setInterval(() => {
      setFadeState('fading');
      
      setTimeout(() => {
        setCurrentUpdateIndex((prev) => (prev + 1) % PLATFORM_UPDATES.length);
        setFadeState('visible');
      }, 500); // Fade out duration
      
    }, 10000); // Change every 10 seconds (increased for readability)

    return () => clearInterval(interval);
  }, [rotating]);

  // Generate floating particles (subtle, non-interfering)
  useEffect(() => {
    if (!animated) return;
    
    const particleCount = displayType === 'event' ? 20 : 10;
    const initial = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: (i / particleCount) * 100,
      delay: Math.random() * 2
    }));
    setParticles(initial);

    // Pulsing glow effect
    let frame = 0;
    const animate = () => {
      frame += 0.02;
      setGlowIntensity(0.8 + Math.sin(frame) * 0.2);
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [animated, displayType]);

  // Animated gradient background
  useEffect(() => {
    if (!animated) return;

    let position = 0;
    const animateGradient = () => {
      position += 0.5;
      setGradientPosition(position % 200);
      requestAnimationFrame(animateGradient);
    };
    const id = requestAnimationFrame(animateGradient);
    return () => cancelAnimationFrame(id);
  }, [animated]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) onDismiss();
  };

  const handleCtaClick = () => {
    if (!displayCtaLink) return;

    // Check if route requires authentication
    if (requiresAuth && !isAuthenticated) {
      // Redirect to login page with return URL
      setLocation(`/auth?redirect=${encodeURIComponent(displayCtaLink)}`);
      return;
    }

    // Navigate to the link
    setLocation(displayCtaLink);
  };

  if (!isVisible) return null;

  const icons: Record<string, any> = {
    announcement: Megaphone,
    update: Code,
    feature: Sparkles,
    event: Gift,
    maintenance: AlertCircle
  };

  const Icon = icons[displayType] || Megaphone;

  // Use seasonal theme colors
  const colors = {
    bg: seasonalTheme.colors.bg,
    border: seasonalTheme.colors.border,
    glow: seasonalTheme.colors.glow,
    icon: seasonalTheme.colors.accent,
    pixel: seasonalTheme.colors.accent.replace('text-', 'bg-')
  };

  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 transition-all duration-500 animate-in slide-in-from-top",
        `bg-gradient-to-r ${colors.bg}`,
        colors.border,
        animated && `shadow-2xl ${colors.glow}`
      )}
      style={{
        boxShadow: animated ? `0 0 ${40 * glowIntensity}px rgba(var(--primary-rgb), ${0.2 * glowIntensity})` : undefined,
        backgroundSize: '200% 200%',
        backgroundPosition: animated ? `${gradientPosition}% 50%` : undefined,
      }}
    >
      {/* Pixel art border effect */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top pixel border */}
        <div className="absolute top-0 left-0 right-0 h-1 flex gap-1 px-2">
          {Array.from({ length: 30 }).map((_, i) => (
            <div 
              key={`top-${i}`} 
              className={cn("flex-1 h-full", colors.pixel)}
              style={{ opacity: (i % 3 === 0) ? 0.6 : 0.3 }}
            />
          ))}
        </div>
        {/* Bottom pixel border */}
        <div className="absolute bottom-0 left-0 right-0 h-1 flex gap-1 px-2">
          {Array.from({ length: 30 }).map((_, i) => (
            <div 
              key={`bottom-${i}`} 
              className={cn("flex-1 h-full", colors.pixel)}
              style={{ opacity: (i % 3 === 0) ? 0.6 : 0.3 }}
            />
          ))}
        </div>
      </div>

      {/* Animated particles/sparkles */}
      {animated && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map(p => (
            <div
              key={p.id}
              className={cn("absolute w-1 h-1 rounded-full", colors.pixel)}
              style={{
                left: `${p.x}%`,
                animation: `float ${3 + p.delay}s ease-in-out ${p.delay}s infinite`,
                opacity: 0.4
              }}
            />
          ))}
        </div>
      )}

      {/* Main content - Compact mobile, full desktop */}
      <div 
        className={cn(
          "relative p-2 md:p-8 flex items-center gap-2 md:gap-6 transition-opacity duration-500",
          fadeState === 'fading' && "opacity-50"
        )}
      >
        {/* Animated icon with pulsing glow - smaller on mobile */}
        {/* Seasonal decorations - subtle, non-interfering */}
        <div className="absolute top-2 left-2 flex gap-1 opacity-30 pointer-events-none select-none" aria-hidden="true">
          {seasonalTheme.decorations.slice(0, 3).map((deco, i) => (
            <span key={i} className="text-xs md:text-sm" style={{ animationDelay: `${i * 0.2}s` }}>
              {deco}
            </span>
          ))}
        </div>

        <div className={cn(
          "shrink-0 w-8 h-8 md:w-16 md:h-16 rounded-lg md:rounded-xl flex items-center justify-center",
          "bg-background/80 backdrop-blur-sm border md:border-2",
          colors.border,
          animated && "animate-pulse"
        )}
        style={{
          boxShadow: animated ? `0 0 ${20 * glowIntensity}px rgba(var(--primary-rgb), ${0.3 * glowIntensity})` : undefined
        }}>
          <div className="relative">
            <Icon className={cn("w-4 h-4 md:w-8 md:h-8", colors.icon)} />
            {/* Emoji overlay if from rotating updates */}
            {currentUpdate && (
              <span className="absolute -top-1 -right-1 text-xs md:text-base">
                {currentUpdate.icon}
              </span>
            )}
          </div>
        </div>

        {/* Text content - readable and prominent */}
        <div className="flex-1 min-w-0">
          <h3 className="text-xs md:text-2xl font-bold mb-0 md:mb-2 flex items-center gap-1 md:gap-2">
            <span className="relative z-10">{displayTitle}</span>
            {displayType === 'event' && <Zap className={cn("w-3 h-3 md:w-5 md:h-5 animate-pulse", colors.icon)} />}
            {requiresAuth && !isAuthenticated && (
              <span className="text-xs md:text-sm opacity-70">(Login Required)</span>
            )}
          </h3>
          <p className="hidden md:block text-sm md:text-base text-muted-foreground relative z-10">
            {displayDescription}
          </p>
        </div>

        {/* CTA Button - use size="lg" for proper touch targets */}
        {displayCtaText && (
          <Button
            variant="default"
            size="lg"
            className={cn(
              "shrink-0 text-xs md:text-base font-semibold md:font-bold min-h-[44px]",
              animated && "hover:scale-105 transition-transform"
            )}
            onClick={handleCtaClick}
            data-testid="button-billboard-cta"
          >
            {displayCtaText}
          </Button>
        )}

        {/* Dismiss button - size="icon" is default 36px (acceptable for non-primary actions) */}
        {dismissible && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            onClick={handleDismiss}
            data-testid="button-billboard-dismiss"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
