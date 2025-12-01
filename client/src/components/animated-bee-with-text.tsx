/**
 * Animated Queen Bee with Emotional Text Display
 * Shows the bee with an animated word below it matching the emotion
 */

import { QueenBeeAnimation, type BeeEmotion } from "@/components/queen-bee-animation";
import { cn } from "@/lib/utils";

interface AnimatedBeeWithTextProps {
  emotion?: BeeEmotion;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  isAnimating?: boolean;
  className?: string;
}

const EMOTION_TEXT_MAP: Record<BeeEmotion, string> = {
  idle: "Ready",
  thinking: "Thinking",
  searching: "Searching",
  coding: "Coding",
  testing: "Testing",
  success: "Success",
  error: "Error",
};

export function AnimatedBeeWithText({
  emotion = "idle",
  size = "md",
  showText = true,
  isAnimating = true,
  className,
}: AnimatedBeeWithTextProps) {
  const text = EMOTION_TEXT_MAP[emotion];
  const sizeClasses = {
    sm: "gap-1",
    md: "gap-2",
    lg: "gap-3",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        sizeClasses[size],
        className
      )}
      data-testid="animated-bee-with-text"
      data-emotion={emotion}
    >
      {/* Queen Bee Animation */}
      <div className="w-full flex items-center justify-center">
        <QueenBeeAnimation
          isAnimating={isAnimating}
          size={size}
          emotion={emotion}
        />
      </div>

      {/* Animated Emotional Text */}
      {showText && (
        <div
          className={cn(
            "font-semibold text-center animated-bee-text",
            size === "sm" && "text-xs",
            size === "md" && "text-sm",
            size === "lg" && "text-base",
            {
              "text-amber-600 dark:text-amber-400": emotion === "idle",
              "text-blue-600 dark:text-blue-400": emotion === "thinking",
              "text-yellow-600 dark:text-yellow-400": emotion === "searching",
              "text-green-600 dark:text-green-400": emotion === "coding",
              "text-purple-600 dark:text-purple-400": emotion === "testing",
              "text-lime-600 dark:text-lime-400": emotion === "success",
              "text-red-600 dark:text-red-400": emotion === "error",
            }
          )}
          data-emotion={emotion}
        >
          <span className="inline-block animate-pulse">{text}</span>
          <span className="ml-1 inline-block animate-bounce" style={{ animationDelay: "0.1s" }}>
            ·
          </span>
          <span className="ml-0.5 inline-block animate-bounce" style={{ animationDelay: "0.2s" }}>
            ·
          </span>
          <span className="ml-0.5 inline-block animate-bounce" style={{ animationDelay: "0.3s" }}>
            ·
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Export animated bee loading state
 */
export function AnimatedBeeLoading({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <AnimatedBeeWithText
      emotion="thinking"
      size={size}
      showText={true}
      isAnimating={true}
      className={className}
    />
  );
}
