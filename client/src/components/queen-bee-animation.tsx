import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface QueenBeeAnimationProps {
  isAnimating?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function QueenBeeAnimation({ isAnimating = true, size = "md", className }: QueenBeeAnimationProps) {
  const sizeMap = {
    sm: { container: "w-10 h-10", svg: 32 },
    md: { container: "w-16 h-16", svg: 64 },
    lg: { container: "w-20 h-20", svg: 80 }
  };

  const { container, svg } = sizeMap[size];

  return (
    <div className={cn(container, "flex items-center justify-center", className)} data-testid="queen-bee-animation">
      <motion.svg
        width={svg}
        height={svg}
        viewBox="0 0 100 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
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
        {/* Left Wing - Slow flap */}
        <motion.ellipse
          cx="25"
          cy="42"
          rx="10"
          ry="16"
          fill="hsl(171, 100%, 42%)"
          opacity="0.7"
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
        
        {/* Right Wing - Slow flap (offset) */}
        <motion.ellipse
          cx="75"
          cy="42"
          rx="10"
          ry="16"
          fill="hsl(171, 100%, 42%)"
          opacity="0.7"
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
        <circle cx="50" cy="28" r="8" fill="hsl(216, 9%, 7%)" />
        
        {/* Eyes - Glow effect */}
        <motion.g
          animate={isAnimating ? { opacity: [1, 0.5, 1] } : {}}
          transition={isAnimating ? { duration: 1.5, repeat: Infinity } : {}}
        >
          <circle cx="47" cy="27" r="2" fill="white" />
          <circle cx="53" cy="27" r="2" fill="white" />
          {/* Eye glow */}
          <circle cx="47" cy="27" r="3" fill="white" opacity="0.3" />
          <circle cx="53" cy="27" r="3" fill="white" opacity="0.3" />
        </motion.g>

        {/* Body - Honey gold */}
        <motion.ellipse
          cx="50"
          cy="48"
          rx="10"
          ry="12"
          fill="hsl(40, 97%, 50%)"
          animate={isAnimating ? { scaleX: [1, 1.05, 1] } : {}}
          transition={isAnimating ? { duration: 2.5, repeat: Infinity } : {}}
        />
        
        {/* Lower body */}
        <motion.ellipse
          cx="50"
          cy="78"
          rx="9"
          ry="16"
          fill="hsl(40, 97%, 50%)"
          animate={isAnimating ? { scaleY: [1, 1.08, 1] } : {}}
          transition={isAnimating ? { duration: 2.5, repeat: Infinity } : {}}
        />

        {/* Stripes - Black */}
        <rect x="43" y="46" width="14" height="2" rx="1" fill="hsl(216, 9%, 7%)" opacity="0.9" />
        <rect x="43" y="70" width="14" height="2" rx="1" fill="hsl(216, 9%, 7%)" opacity="0.9" />
        <rect x="44" y="78" width="12" height="2" rx="1" fill="hsl(216, 9%, 7%)" opacity="0.9" />
        <rect x="45" y="86" width="10" height="2" rx="1" fill="hsl(216, 9%, 7%)" opacity="0.9" />

        {/* Glow aura */}
        <motion.circle
          cx="50"
          cy="65"
          r="35"
          fill="hsl(40, 97%, 50%)"
          opacity={isAnimating ? 0.1 : 0}
          animate={isAnimating ? { r: [32, 40, 32], opacity: [0.15, 0.05, 0.15] } : {}}
          transition={isAnimating ? { duration: 2.5, repeat: Infinity } : {}}
        />
      </motion.svg>
    </div>
  );
}
