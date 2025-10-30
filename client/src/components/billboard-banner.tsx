import { useState, useEffect } from 'react';
import { X, Sparkles, Megaphone, Gift, Rocket, Zap, Bot, Code, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface FeatureMessage {
  icon: string;
  title: string;
  description: string;
  cta: string;
  link: string;
  type: 'announcement' | 'promo' | 'feature' | 'celebration';
}

const REAL_FEATURES: FeatureMessage[] = [
  {
    icon: "🤖",
    title: "New Feature: LomuAI Auto-Healing!",
    description: "Our AI now automatically fixes bugs and deploys updates - watch your platform heal itself in real-time",
    cta: "See It In Action",
    link: "/builder", // Changed to /builder (public) instead of /platform-healing (admin-only)
    type: "announcement"
  },
  {
    icon: "🚀",
    title: "Instant Deployment Ready!",
    description: "Deploy your projects to production with one click - Railway and Render integration built-in",
    cta: "Start Deploying",
    link: "/publishing",
    type: "feature"
  },
  {
    icon: "💬",
    title: "AI-Powered Code Generation!",
    description: "SySop builds full-stack apps from natural language - just describe what you want to build",
    cta: "Try SySop",
    link: "/builder",
    type: "feature"
  },
  {
    icon: "🍋",
    title: "Meet Lumo - Your AI Companion!",
    description: "Interactive lemon mascot with mood-based animations and particle effects - alive and responsive",
    cta: "Meet Lumo",
    link: "/builder", // Changed to /builder where Lumo appears in SySop chat
    type: "celebration"
  },
  {
    icon: "📊",
    title: "Real-Time Task Management!",
    description: "Track AI agent progress with live task lists - see exactly what's being built in real-time",
    cta: "View Tasks",
    link: "/builder", // Changed to /builder where task management is visible
    type: "feature"
  },
  {
    icon: "🔄",
    title: "Webhook Automation!",
    description: "Auto-deploy on every GitHub commit - your platform updates itself automatically",
    cta: "Configure Webhooks",
    link: "/publishing", // Changed to /publishing for deployment features
    type: "promo"
  },
];

interface BillboardBannerProps {
  // Optional props to override rotating messages
  title?: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  type?: 'announcement' | 'promo' | 'feature' | 'celebration';
  onDismiss?: () => void;
  dismissible?: boolean;
  animated?: boolean;
  rotating?: boolean; // Enable rotation through REAL_FEATURES
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
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const [fadeState, setFadeState] = useState<'visible' | 'fading'>('visible');
  const [gradientPosition, setGradientPosition] = useState(0);

  // Current feature (either from rotation or props)
  const currentFeature = rotating ? REAL_FEATURES[currentFeatureIndex] : null;
  const displayTitle = currentFeature?.title || title || "";
  const displayDescription = currentFeature?.description || description || "";
  const displayCtaText = currentFeature?.cta || ctaText;
  const displayCtaLink = currentFeature?.link || ctaLink;
  const displayType = currentFeature?.type || type || 'announcement';

  // Rotate through features every 8 seconds
  useEffect(() => {
    if (!rotating) return;

    const interval = setInterval(() => {
      setFadeState('fading');
      
      setTimeout(() => {
        setCurrentFeatureIndex((prev) => (prev + 1) % REAL_FEATURES.length);
        setFadeState('visible');
      }, 500); // Fade out duration
      
    }, 8000); // Change every 8 seconds

    return () => clearInterval(interval);
  }, [rotating]);

  // Generate floating particles
  useEffect(() => {
    if (!animated) return;
    
    const particleCount = displayType === 'celebration' ? 20 : 10;
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
    if (displayCtaLink) {
      setLocation(displayCtaLink);
    }
  };

  if (!isVisible) return null;

  const icons = {
    announcement: Megaphone,
    promo: Gift,
    feature: Sparkles,
    celebration: Rocket
  };

  const Icon = icons[displayType];

  const colorSchemes = {
    announcement: {
      bg: 'from-primary/20 via-primary/10 to-secondary/20',
      border: 'border-primary/30',
      glow: 'shadow-primary/20',
      icon: 'text-primary',
      pixel: 'bg-primary'
    },
    promo: {
      bg: 'from-accent/20 via-secondary/10 to-primary/20',
      border: 'border-accent/30',
      glow: 'shadow-accent/20',
      icon: 'text-accent',
      pixel: 'bg-accent'
    },
    feature: {
      bg: 'from-secondary/20 via-primary/10 to-accent/20',
      border: 'border-secondary/30',
      glow: 'shadow-secondary/20',
      icon: 'text-secondary',
      pixel: 'bg-secondary'
    },
    celebration: {
      bg: 'from-primary/30 via-accent/20 to-secondary/30',
      border: 'border-primary/40',
      glow: 'shadow-primary/30',
      icon: 'text-primary',
      pixel: 'bg-gradient-to-r from-primary to-accent'
    }
  };

  const colors = colorSchemes[displayType];

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
            {/* Emoji overlay if from rotating features */}
            {currentFeature && (
              <span className="absolute -top-1 -right-1 text-xs md:text-base">
                {currentFeature.icon}
              </span>
            )}
          </div>
        </div>

        {/* Text content - minimal on mobile */}
        <div className="flex-1 min-w-0">
          <h3 className="text-xs md:text-2xl font-bold mb-0 md:mb-2 flex items-center gap-1 md:gap-2">
            {displayTitle}
            {displayType === 'celebration' && <Zap className={cn("w-3 h-3 md:w-5 md:h-5 animate-pulse", colors.icon)} />}
          </h3>
          <p className="hidden md:block text-sm md:text-base text-muted-foreground">
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
