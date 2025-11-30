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
