import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface QueenBeeAnimationProps {
  isAnimating?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function QueenBeeAnimation({ isAnimating = true, size = "md", className }: QueenBeeAnimationProps) {
  const sizeMap = {
    sm: { svg: 24 },
    md: { svg: 40 },
    lg: { svg: 64 }
  };

  const { svg } = sizeMap[size];

  return (
    <div className={cn("w-full h-full flex items-center justify-center", className)} data-testid="queen-bee-animation">
      <motion.svg
        width={svg}
        height={svg}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        animate={isAnimating ? {
          y: [0, -8, 0],
          rotate: [0, 2, -2, 0]
        } : {}}
        transition={isAnimating ? {
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut"
        } : {}}
      >
        {/* Left Wing */}
        <motion.ellipse
          cx="30"
          cy="35"
          rx="8"
          ry="12"
          fill="hsl(171, 100%, 42%)"
          opacity="0.75"
          animate={isAnimating ? {
            scaleY: [0.8, 1.2, 0.8],
            rotateZ: [-15, 15, -15]
          } : {}}
          transition={isAnimating ? {
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut"
          } : {}}
        />
        
        {/* Right Wing */}
        <motion.ellipse
          cx="70"
          cy="35"
          rx="8"
          ry="12"
          fill="hsl(171, 100%, 42%)"
          opacity="0.75"
          animate={isAnimating ? {
            scaleY: [0.8, 1.2, 0.8],
            rotateZ: [15, -15, 15]
          } : {}}
          transition={isAnimating ? {
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.1
          } : {}}
        />

        {/* Head */}
        <circle cx="50" cy="25" r="6" fill="hsl(216, 9%, 7%)" />
        
        {/* Eyes - Glow effect */}
        <motion.g
          animate={isAnimating ? { opacity: [1, 0.5, 1] } : {}}
          transition={isAnimating ? { duration: 1.5, repeat: Infinity } : {}}
        >
          <circle cx="48" cy="24" r="1.5" fill="white" />
          <circle cx="52" cy="24" r="1.5" fill="white" />
          {/* Eye glow */}
          <circle cx="48" cy="24" r="2.5" fill="white" opacity="0.3" />
          <circle cx="52" cy="24" r="2.5" fill="white" opacity="0.3" />
        </motion.g>

        {/* Body - Honey gold */}
        <motion.ellipse
          cx="50"
          cy="42"
          rx="8"
          ry="10"
          fill="hsl(40, 97%, 50%)"
          animate={isAnimating ? { scaleX: [1, 1.05, 1] } : {}}
          transition={isAnimating ? { duration: 2.5, repeat: Infinity } : {}}
        />
        
        {/* Lower body */}
        <motion.ellipse
          cx="50"
          cy="62"
          rx="7"
          ry="12"
          fill="hsl(40, 97%, 50%)"
          animate={isAnimating ? { scaleY: [1, 1.08, 1] } : {}}
          transition={isAnimating ? { duration: 2.5, repeat: Infinity } : {}}
        />

        {/* Stripes - Black */}
        <rect x="45" y="40" width="10" height="1.5" rx="0.75" fill="hsl(216, 9%, 7%)" opacity="0.9" />
        <rect x="45" y="58" width="10" height="1.5" rx="0.75" fill="hsl(216, 9%, 7%)" opacity="0.9" />
        <rect x="46" y="65" width="8" height="1.5" rx="0.75" fill="hsl(216, 9%, 7%)" opacity="0.9" />

        {/* Glow aura */}
        <motion.circle
          cx="50"
          cy="50"
          r="25"
          fill="hsl(40, 97%, 50%)"
          opacity={isAnimating ? 0.1 : 0}
          animate={isAnimating ? { r: [22, 28, 22], opacity: [0.15, 0.05, 0.15] } : {}}
          transition={isAnimating ? { duration: 2.5, repeat: Infinity } : {}}
        />
      </motion.svg>
    </div>
  );
}
