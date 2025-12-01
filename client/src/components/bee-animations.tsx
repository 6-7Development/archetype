import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

export function useMotionConfig() {
  const shouldReduceMotion = useReducedMotion();
  
  return {
    shouldReduceMotion,
    transition: shouldReduceMotion 
      ? { duration: 0 } 
      : { duration: 0.2 },
    springTransition: shouldReduceMotion
      ? { type: "tween", duration: 0 }
      : { type: "spring", stiffness: 400, damping: 25 },
    noAnimation: { initial: false, animate: false, exit: false, transition: { duration: 0 } }
  };
}

interface HexOrbitLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function HexOrbitLoader({ size = "md", className }: HexOrbitLoaderProps) {
  const sizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div 
      className={cn("hex-orbit-loader", sizes[size], className)}
      data-testid="hex-orbit-loader"
    />
  );
}

interface ThinkingDotsProps {
  className?: string;
}

export function ThinkingDots({ className }: ThinkingDotsProps) {
  return (
    <span className={cn("thinking-dots inline-flex items-center", className)} data-testid="thinking-dots">
      <span />
      <span />
      <span />
    </span>
  );
}

interface SuccessCheckProps {
  show: boolean;
  size?: number;
  className?: string;
}

export function SuccessCheck({ show, size = 24, className }: SuccessCheckProps) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", duration: 0.4 }}
          className={cn("inline-flex items-center justify-center", className)}
          data-testid="success-check"
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-green-500"
          >
            <motion.path
              d="M5 12l5 5L20 7"
              initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, delay: 0.1 }}
            />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface PulseButtonProps {
  children: React.ReactNode;
  isPulsing?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

export function PulseButton({ 
  children, 
  isPulsing = false, 
  onClick, 
  disabled,
  className,
  type = "button"
}: PulseButtonProps) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative inline-flex items-center justify-center",
        isPulsing && !shouldReduceMotion && "honeycomb-pulse",
        className
      )}
      whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.1 }}
      data-testid="pulse-button"
    >
      {children}
    </motion.button>
  );
}

interface StatusBadgeProps {
  status: "idle" | "working" | "success" | "error";
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const statusClasses = {
    idle: "",
    working: "swarm-buzz",
    success: "badge-pulse success-shimmer",
    error: "badge-pulse"
  };

  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full",
        statusClasses[status],
        className
      )}
      data-testid={`status-badge-${status}`}
    >
      {status === "working" && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === "success" && <Check className="w-3 h-3" />}
      {children}
    </span>
  );
}

interface SlideInProps {
  children: React.ReactNode;
  direction?: "left" | "right" | "up" | "down";
  delay?: number;
  className?: string;
}

export function SlideIn({ 
  children, 
  direction = "up", 
  delay = 0,
  className 
}: SlideInProps) {
  const shouldReduceMotion = useReducedMotion();
  
  const variants = {
    left: { initial: { x: -20, opacity: 0 }, animate: { x: 0, opacity: 1 } },
    right: { initial: { x: 20, opacity: 0 }, animate: { x: 0, opacity: 1 } },
    up: { initial: { y: 12, opacity: 0 }, animate: { y: 0, opacity: 1 } },
    down: { initial: { y: -12, opacity: 0 }, animate: { y: 0, opacity: 1 } }
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? false : variants[direction].initial}
      animate={variants[direction].animate}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeIn({ 
  children, 
  delay = 0, 
  duration = 0.2,
  className 
}: FadeInProps) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface ScaleInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function ScaleIn({ children, delay = 0, className }: ScaleInProps) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      initial={shouldReduceMotion ? false : { scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={shouldReduceMotion 
        ? { duration: 0 } 
        : { type: "spring", stiffness: 400, damping: 25, delay }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface RowHighlightProps {
  isNew?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function RowHighlight({ isNew = false, children, className }: RowHighlightProps) {
  return (
    <div 
      className={cn(
        "transition-colors duration-300",
        isNew && "status-sweep",
        className
      )}
      data-testid="row-highlight"
    >
      {children}
    </div>
  );
}

interface HiveWarmupProps {
  children: React.ReactNode;
  isActive?: boolean;
  className?: string;
}

export function HiveWarmup({ children, isActive = false, className }: HiveWarmupProps) {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.div
      initial={shouldReduceMotion ? false : (isActive ? { opacity: 0.5, filter: "blur(2px)" } : false)}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const beeMotionVariants = {
  fadeInUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.2 }
  },
  scaleIn: {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.9, opacity: 0 },
    transition: { type: "spring", stiffness: 400, damping: 25 }
  },
  slideInRight: {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 },
    transition: { duration: 0.25 }
  },
  slideInLeft: {
    initial: { x: -20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 20, opacity: 0 },
    transition: { duration: 0.25 }
  },
  pulse: {
    animate: {
      scale: [1, 1.02, 1],
      boxShadow: [
        "0 0 0 0 rgba(247, 181, 0, 0.4)",
        "0 0 0 8px rgba(247, 181, 0, 0)",
        "0 0 0 0 rgba(247, 181, 0, 0)"
      ]
    },
    transition: { duration: 2, repeat: Infinity }
  },
  stagger: {
    animate: {
      transition: { staggerChildren: 0.05 }
    }
  }
};

export const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 25
};

export const easeTransition = {
  duration: 0.25,
  ease: "easeOut"
};

export type BeeStatus = 'idle' | 'thinking' | 'working' | 'executing' | 'success' | 'error' | 'warning';

interface BeeStatusIndicatorProps {
  status: BeeStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function BeeStatusIndicator({ 
  status, 
  size = 'sm', 
  showLabel = false, 
  label,
  className 
}: BeeStatusIndicatorProps) {
  const shouldReduceMotion = useReducedMotion();
  
  const sizes = {
    xs: { icon: 'w-3 h-3', container: 'gap-1', text: 'text-xs' },
    sm: { icon: 'w-4 h-4', container: 'gap-1.5', text: 'text-sm' },
    md: { icon: 'w-5 h-5', container: 'gap-2', text: 'text-sm' },
    lg: { icon: 'w-6 h-6', container: 'gap-2', text: 'text-base' },
  };

  const statusConfig = {
    idle: {
      color: 'text-muted-foreground',
      bg: 'bg-muted/50',
      animation: '',
      defaultLabel: 'Ready',
    },
    thinking: {
      color: 'text-honey',
      bg: 'bg-honey/10',
      animation: 'bee-thinking',
      defaultLabel: 'Thinking...',
    },
    working: {
      color: 'text-honey',
      bg: 'bg-honey/10',
      animation: 'bee-working',
      defaultLabel: 'Working...',
    },
    executing: {
      color: 'text-mint',
      bg: 'bg-mint/10',
      animation: 'bee-executing',
      defaultLabel: 'Executing...',
    },
    success: {
      color: 'text-mint',
      bg: 'bg-mint/10',
      animation: 'bee-success',
      defaultLabel: 'Complete',
    },
    error: {
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      animation: '',
      defaultLabel: 'Error',
    },
    warning: {
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      animation: '',
      defaultLabel: 'Warning',
    },
  };

  const config = statusConfig[status];
  const displayLabel = label || config.defaultLabel;

  return (
    <div 
      className={cn(
        "inline-flex items-center",
        sizes[size].container,
        className
      )}
      data-testid={`bee-status-${status}`}
    >
      <motion.div
        className={cn(
          "relative flex items-center justify-center rounded-full",
          sizes[size].icon,
          config.bg,
          !shouldReduceMotion && config.animation
        )}
        initial={false}
        animate={
          !shouldReduceMotion && (status === 'thinking' || status === 'working') 
            ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }
            : {}
        }
        transition={
          !shouldReduceMotion 
            ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0 }
        }
      >
        <svg 
          viewBox="0 0 24 24" 
          className={cn("w-full h-full", config.color)}
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Head */}
          <circle cx="12" cy="4" r="2.5" fill="currentColor" />
          {/* Thorax - Main body section */}
          <ellipse cx="12" cy="10" rx="2.5" ry="3.5" fill="currentColor" />
          {/* Abdomen stripes */}
          <rect x="10" y="13.5" width="4" height="1.5" fill="currentColor" opacity="0.8" />
          <ellipse cx="12" cy="16" rx="2.5" ry="2.5" fill="currentColor" opacity="0.9" />
          <rect x="10" y="18.5" width="4" height="1.2" fill="currentColor" opacity="0.7" />
          {/* Left wing */}
          <path d="M9 9 Q6 6 5 4" stroke="currentColor" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          {/* Right wing */}
          <path d="M15 9 Q18 6 19 4" stroke="currentColor" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          {/* Eyes */}
          <circle cx="11" cy="3" r="0.5" fill="currentColor" opacity="0.6" />
          <circle cx="13" cy="3" r="0.5" fill="currentColor" opacity="0.6" />
        </svg>
        
        {(status === 'thinking' || status === 'working' || status === 'executing') && (
          <motion.div
            className={cn(
              "absolute inset-0 rounded-full border-2 border-current opacity-30",
              config.color
            )}
            initial={{ scale: 0.8, opacity: 0.6 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 1.2,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        )}
      </motion.div>
      
      {showLabel && (
        <span className={cn(sizes[size].text, config.color, "font-medium")}>
          {displayLabel}
        </span>
      )}
    </div>
  );
}

interface InlineBeeProgressProps {
  message: string;
  status?: BeeStatus;
  timestamp?: number;
  category?: 'thinking' | 'action' | 'result';
  className?: string;
}

export function InlineBeeProgress({ 
  message, 
  status = 'working',
  timestamp,
  category,
  className 
}: InlineBeeProgressProps) {
  const shouldReduceMotion = useReducedMotion();
  
  const categoryConfig = {
    thinking: { status: 'thinking' as BeeStatus, color: 'text-honey border-honey/20' },
    action: { status: 'executing' as BeeStatus, color: 'text-mint border-mint/20' },
    result: { status: 'success' as BeeStatus, color: 'text-mint border-mint/20' },
  };
  
  const config = category ? categoryConfig[category] : { status, color: 'text-muted-foreground border-border' };

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-start gap-2 py-1.5 px-2 rounded-md border bg-card/50",
        config.color,
        className
      )}
      data-testid="inline-bee-progress"
    >
      <BeeStatusIndicator status={config.status} size="xs" />
      <span className="text-sm flex-1">{message}</span>
      {timestamp && (
        <span className="text-xs text-muted-foreground opacity-60">
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </motion.div>
  );
}
