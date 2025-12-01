import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type BeeEmotion = "idle" | "thinking" | "searching" | "coding" | "testing" | "success" | "error";

interface QueenBeeAnimationProps {
  isAnimating?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  emotion?: BeeEmotion;
}

export function QueenBeeAnimation({ isAnimating = true, size = "md", className, emotion = "idle" }: QueenBeeAnimationProps) {
  const sizeMap = {
    sm: { svg: 24 },
    md: { svg: 40 },
    lg: { svg: 64 }
  };

  const { svg } = sizeMap[size];

  // Animation configs based on emotion
  const emotionConfigs = {
    idle: {
      body: { y: [0, -4, 0], rotate: [0, 1, -1, 0] },
      wings: { duration: 2.5, scaleY: [0.8, 1.2, 0.8], rotateZ: [-15, 15, -15] },
      eyes: { duration: 1.5 },
      glow: { duration: 2.5, r: [22, 28, 22], color: "hsl(40, 97%, 50%)" }
    },
    thinking: {
      body: { y: [0, -6, 0], rotate: [0, 1.5, -1.5, 0] },
      wings: { duration: 3, scaleY: [0.9, 1.1, 0.9], rotateZ: [-10, 10, -10] },
      eyes: { duration: 2 },
      glow: { duration: 3, r: [24, 32, 24], color: "hsl(217, 100%, 60%)" }
    },
    searching: {
      body: { y: [0, -10, 0], rotate: [0, 3, -3, 0] },
      wings: { duration: 1.2, scaleY: [0.7, 1.3, 0.7], rotateZ: [-20, 20, -20] },
      eyes: { duration: 0.8 },
      glow: { duration: 1.2, r: [20, 35, 20], color: "hsl(48, 100%, 65%)" }
    },
    coding: {
      body: { y: [0, -5, 0], rotate: [0, 0.5, -0.5, 0] },
      wings: { duration: 2, scaleY: [0.85, 1.15, 0.85], rotateZ: [-12, 12, -12] },
      eyes: { duration: 1.2 },
      glow: { duration: 2, r: [23, 30, 23], color: "hsl(142, 71%, 45%)" }
    },
    testing: {
      body: { y: [0, -12, 0], rotate: [0, 2, -2, 0] },
      wings: { duration: 1.5, scaleY: [0.7, 1.3, 0.7], rotateZ: [-18, 18, -18] },
      eyes: { duration: 1 },
      glow: { duration: 1.5, r: [21, 33, 21], color: "hsl(262, 80%, 50%)" }
    },
    success: {
      body: { y: [0, -15, 0], rotate: [0, 5, -5, 0] },
      wings: { duration: 1.2, scaleY: [0.6, 1.4, 0.6], rotateZ: [-25, 25, -25] },
      eyes: { duration: 0.8 },
      glow: { duration: 1.2, r: [25, 40, 25], color: "hsl(142, 76%, 36%)" }
    },
    error: {
      body: { y: [0, -3, 0], rotate: [0, -2, 2, 0] },
      wings: { duration: 3.5, scaleY: [0.9, 1.05, 0.9], rotateZ: [-8, 8, -8] },
      eyes: { duration: 2 },
      glow: { duration: 3.5, r: [22, 26, 22], color: "hsl(0, 84%, 60%)" }
    }
  };

  const config = emotionConfigs[emotion] || emotionConfigs.idle;

  return (
    <div className={cn("w-full h-full flex items-center justify-center", className)} data-testid="queen-bee-animation" data-emotion={emotion}>
      <motion.svg
        width={svg}
        height={svg}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        animate={isAnimating ? config.body : {}}
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
            scaleY: config.wings.scaleY,
            rotateZ: config.wings.rotateZ
          } : {}}
          transition={isAnimating ? {
            duration: config.wings.duration,
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
            scaleY: config.wings.scaleY,
            rotateZ: config.wings.rotateZ.map((v: number) => -v)
          } : {}}
          transition={isAnimating ? {
            duration: config.wings.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.1
          } : {}}
        />

        {/* Head */}
        <circle cx="50" cy="25" r="6" fill="hsl(216, 9%, 7%)" />
        
        {/* Eyes - Emotion-based glow */}
        <motion.g
          animate={isAnimating ? { opacity: [1, 0.5, 1] } : {}}
          transition={isAnimating ? { duration: config.eyes.duration, repeat: Infinity } : {}}
        >
          <circle cx="48" cy="24" r="1.5" fill="white" />
          <circle cx="52" cy="24" r="1.5" fill="white" />
          {/* Eye glow */}
          <circle cx="48" cy="24" r="2.5" fill="white" opacity="0.3" />
          <circle cx="52" cy="24" r="2.5" fill="white" opacity="0.3" />
        </motion.g>

        {/* Body - Emotion-colored */}
        <motion.ellipse
          cx="50"
          cy="42"
          rx="8"
          ry="10"
          fill="hsl(40, 97%, 50%)"
          animate={isAnimating ? { scaleX: [1, 1.05, 1] } : {}}
          transition={isAnimating ? { duration: config.glow.duration, repeat: Infinity } : {}}
        />
        
        {/* Lower body */}
        <motion.ellipse
          cx="50"
          cy="62"
          rx="7"
          ry="12"
          fill="hsl(40, 97%, 50%)"
          animate={isAnimating ? { scaleY: [1, 1.08, 1] } : {}}
          transition={isAnimating ? { duration: config.glow.duration, repeat: Infinity } : {}}
        />

        {/* Stripes - Black */}
        <rect x="45" y="40" width="10" height="1.5" rx="0.75" fill="hsl(216, 9%, 7%)" opacity="0.9" />
        <rect x="45" y="58" width="10" height="1.5" rx="0.75" fill="hsl(216, 9%, 7%)" opacity="0.9" />
        <rect x="46" y="65" width="8" height="1.5" rx="0.75" fill="hsl(216, 9%, 7%)" opacity="0.9" />

        {/* Emotion-based Glow aura */}
        <motion.circle
          cx="50"
          cy="50"
          r={config.glow.r[0]}
          fill={config.glow.color}
          opacity={isAnimating ? 0.1 : 0}
          animate={isAnimating ? { r: config.glow.r, opacity: [0.15, 0.05, 0.15] } : {}}
          transition={isAnimating ? { duration: config.glow.duration, repeat: Infinity } : {}}
        />
      </motion.svg>
    </div>
  );
}
