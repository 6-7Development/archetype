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
  error: "SWARM",
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
      className={cn("w-full h-full flex items-center justify-center", className)}
      data-testid="queen-bee-animation"
      data-emotion={emotion}
    >
      {isAnimating && (
        <QueenBeeCanvas
          mode={mode}
          width={pixels}
          height={pixels}
          className="w-full h-full"
        />
      )}
    </div>
  );
}
