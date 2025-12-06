/**
 * Queen Bee Animation Component with Emotional States
 * Maps BeeEmotion states to canvas-based animation modes
 */

import { QueenBeeCanvas, type BeeMode } from "./queen-bee-canvas";
import { cn } from "@/lib/utils";

export type BeeEmotion = "idle" | "thinking" | "searching" | "coding" | "testing" | "success" | "error";

interface QueenBeeAnimationProps {
  isAnimating?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  emotion?: BeeEmotion;
}

// Map BeeEmotion to canvas animation modes
const EMOTION_MODE_MAP: Record<BeeEmotion, BeeMode> = {
  idle: "IDLE",
  thinking: "THINKING",
  searching: "THINKING",
  coding: "CODING",
  testing: "BUILDING",
  success: "IDLE",
  error: "ERROR",
};

// Size mappings for canvas width/height
const SIZE_PIXELS = {
  sm: 32,
  md: 48,
  lg: 64,
};

export function QueenBeeAnimation({
  isAnimating = true,
  size = "md",
  className,
  emotion = "idle",
}: QueenBeeAnimationProps) {
  const mode = EMOTION_MODE_MAP[emotion];
  const pixels = SIZE_PIXELS[size];

  return (
    <div
      className={cn(
        "w-full h-full flex items-center justify-center inline-flex",
        className
      )}
      data-testid="queen-bee-animation"
      data-emotion={emotion}
    >
      {isAnimating ? (
        <QueenBeeCanvas
          mode={mode}
          width={pixels}
          height={pixels}
          className="w-full h-full object-contain"
        />
      ) : (
        // Fallback static bee icon for non-animating mode
        <svg 
          viewBox="0 0 24 24" 
          className="w-full h-full text-white"
          fill="currentColor"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
        </svg>
      )}
    </div>
  );
}
